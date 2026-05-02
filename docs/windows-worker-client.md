# Windows Transcription Worker Client

This worker runs on Nikita's Windows RTX 4070 Ti machine. It claims queued
Voicy transcription jobs from the backend, downloads the Telegram audio file,
runs a local GPU transcription command, and uploads the final transcript over
the authenticated worker API.

## Backend Prep

Build the server code and create a worker token from a trusted backend shell:

```sh
yarn build-ts
MONGO='mongodb://...' yarn worker:create-client windows-4070-ti
```

Store the printed token in the Windows worker environment as
`VOICY_WORKER_TOKEN`. The token is shown only once; the backend stores only its
SHA-256 hash in the `WorkerClient` collection.

If the token is lost or exposed, create a new worker client token and disable
the old Mongo record by setting `enabled` to `false`. Do not commit the token to
this repo, paste it into task comments, or share it in logs.

## Authentication and Security Model

The worker API is mounted under `/worker/v1`. Every request must include:

```text
Authorization: Bearer <VOICY_WORKER_TOKEN>
```

The server accepts the request only when the token hash matches an enabled
`WorkerClient`. Missing, malformed, disabled, or unknown tokens receive `401`.
Worker clients cannot create arbitrary transcription jobs through this API; jobs
are created by the bot/backend from Telegram messages, and authenticated workers
can only claim queued jobs, read the source for jobs they own, heartbeat, upload
progress, upload final results, or report failures.

Run the worker from a dedicated Windows account or service with access only to
its work directory and environment variables. Keep `VOICY_WORKER_WORK_DIR` local
to the machine because it temporarily stores downloaded Telegram audio and
transcript JSON files.

## Windows GPU Setup

Install these on the Windows machine:

- NVIDIA driver current enough for CUDA 12.
- Python 3.11.
- Node.js 20 LTS or newer.
- Git.
- FFmpeg available on `PATH`.

Create a Python virtual environment for GPU transcription:

```powershell
py -3.11 -m venv C:\voicy-worker\.venv
C:\voicy-worker\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install faster-whisper
```

`faster-whisper` uses CTranslate2. On the 4070 Ti, start with the
`large-v3` model on CUDA with `float16`; reduce to `medium` if VRAM or latency
becomes a problem.

The checked-in `scripts/whisper-transcriber.js` adapter can run the local OpenAI Whisper CLI directly and emit the worker JSON format. For the Windows GPU host you can keep using a custom `faster-whisper` Python command if that is faster, as long as it writes this same JSON shape to `{output}`.

Example `C:\voicy-worker\transcribe.py` for `faster-whisper`:

```python
import json
import sys
from faster_whisper import WhisperModel

input_path = sys.argv[1]
output_path = sys.argv[2]
language = sys.argv[3] or None

model = WhisperModel("large-v3", device="cuda", compute_type="float16")
segments, info = model.transcribe(input_path, language=language, vad_filter=True)

parts = []
for segment in segments:
    minutes = int(segment.start // 60)
    seconds = int(segment.start % 60)
    text = segment.text.strip()
    if text:
        parts.append({"timeCode": f"{minutes:02d}:{seconds:02d}", "text": text})

result = {
    "text": "\n".join(part["text"] for part in parts),
    "parts": parts,
    "language": info.language,
    "duration": info.duration,
    "metadata": {
        "model": "large-v3",
        "device": "cuda",
        "computeType": "float16",
    },
}

with open(output_path, "w", encoding="utf-8") as output:
    json.dump(result, output, ensure_ascii=False)
```

## Worker Configuration

Build the repo on the Windows machine:

```powershell
yarn install --frozen-lockfile
yarn build-ts
```

Set environment variables:

```powershell
$env:VOICY_WORKER_API_URL = "https://<voicy-host>/worker/v1"
$env:VOICY_WORKER_TOKEN = "voicy_worker_..."
$env:VOICY_WORKER_WORK_DIR = "C:\voicy-worker\jobs"
$env:VOICY_WORKER_ENGINE = "faster-whisper"
$env:VOICY_WORKER_MODEL = "large-v3"
$env:VOICY_WORKER_HEARTBEAT_INTERVAL_MS = "30000"
$env:VOICY_WORKER_POLL_INTERVAL_MS = "5000"
$env:VOICY_WORKER_TRANSCRIBE_COMMAND = "C:\voicy-worker\.venv\Scripts\python.exe C:\voicy-worker\transcribe.py {input} {output} {language}"
```

For CPU or smoke-test environments with the OpenAI Whisper CLI installed, use the checked-in adapter instead:

```powershell
$env:VOICY_WHISPER_MODEL = "small"
$env:VOICY_WHISPER_COMMAND = "C:\Users\<user>\AppData\Local\Programs\Python\Python311\Scripts\whisper.exe"
$env:VOICY_WORKER_ENGINE = "openai-whisper-cli"
$env:VOICY_WORKER_MODEL = "small"
$env:VOICY_WORKER_TRANSCRIBE_COMMAND = "node scripts/whisper-transcriber.js {input} {output} {language}"
```

`VOICY_WHISPER_COMMAND` is optional when `whisper` is already on `PATH`, but it
is the safest service/launchd setting because non-interactive environments often
have a smaller `PATH` than an interactive terminal. On macOS/Homebrew test
hosts, the adapter also appends `/opt/homebrew/bin` and `/usr/local/bin` when it
spawns `whisper`, which protects the local test worker from launchd's default
`PATH=/usr/bin:/bin`.

Optional:

- `VOICY_WORKER_LANGUAGE=en` forces a language when the queued job has no hint.
- `VOICY_WORKER_IDLE_EXIT=1` processes at most one available job and exits,
  useful for smoke tests or scheduled runs.
- `VOICY_WORKER_DOWNLOAD_TIMEOUT_MS=300000` controls audio download timeout.

Run the worker:

```powershell
yarn worker:run
```

For a one-job smoke test, add `VOICY_WORKER_IDLE_EXIT=1` before running the
worker. The process exits after processing one available job, or exits
immediately if no queued job is available.

## Runtime Behavior

The client polls `POST /jobs/claim`. If there is no work, it sleeps for
`VOICY_WORKER_POLL_INTERVAL_MS`.

For each claimed job it:

1. Reads source metadata from `GET /jobs/:id/source`.
2. Downloads `sourceUrl` into `VOICY_WORKER_WORK_DIR`.
3. Starts heartbeat posts while local transcription runs.
4. Runs `VOICY_WORKER_TRANSCRIBE_COMMAND`.
5. Reads transcript JSON from `{output}` or plain text from stdout.
6. Uploads the result to `POST /jobs/:id/result`.

The command template supports `{input}`, `{output}`, and `{language}`. Paths are
quoted before replacement so spaces in Windows paths are supported.

The checked-in worker client uploads the final result after the command exits.
Streaming-capable custom workers may call `POST /jobs/:id/progress` while a
transcription command emits stable segments, then must still call
`POST /jobs/:id/result` with the final transcript. Voicy stores accepted partial
payloads and throttles visible Telegram edits server-side.

## Retry and Error Behavior

Download failures, command crashes, and upload failures are reported to
`POST /jobs/:id/failure` with `retryable: true`. The backend requeues retryable
jobs until `VOICY_WORKER_MAX_ATTEMPTS` is reached, then marks them failed.

If the transcription command exits successfully but produces no transcript text,
the client reports a non-retryable failure. That avoids repeatedly processing a
file the local model cannot decode into text.

## Validation

Local code validation:

```sh
yarn build-ts
yarn lint
yarn test:progress-policy
yarn test:worker-client
yarn test:whisper-transcriber
VOICY_WHISPER_MODEL=tiny yarn test:worker-local-stt
MONGO=mongodb://127.0.0.1:27017/voicy_worker_proof yarn test:worker-e2e
```

`yarn test:worker-client` runs the compiled client against a mock worker API,
downloads a fake audio payload, executes a fake transcriber, uploads the result,
checks the no-work polling path, and checks retryable command failure reporting.

`yarn test:worker-e2e` uses the real Express worker API, local Mongo, a queued
`TranscriptionJob`, a local sample-audio HTTP server, and the worker client. It
disables Telegram network publishing with `VOICY_DISABLE_TELEGRAM_PUBLISH=1`,
but still verifies that the completed job creates the final `Voice` record.

End-to-end validation needs a deployed Voicy backend with Mongo, Telegram token,
and a real worker token. Send or enqueue a sample Telegram voice message, start
the Windows worker, and verify the Telegram status message is replaced with the
final transcript after the worker submits the result.

## macOS Test Bot LaunchAgent

The local test bot on Nikita's Mac can use the same worker client under launchd.
Build the repo, export the worker environment, and print the generated plist:

```sh
yarn build-ts
export VOICY_WORKER_API_URL=http://127.0.0.1:3000/worker/v1
export VOICY_WORKER_TOKEN=voicy_worker_...
export VOICY_WORKER_TRANSCRIBE_COMMAND='node scripts/whisper-transcriber.js {input} {output} {language}'
yarn worker:print-macos-test-launchd
```

Load or restart the worker:

```sh
yarn worker:install-macos-test-launchd
launchctl kickstart -k gui/$UID/com.voicy.test-worker
```

The installer writes `~/Library/LaunchAgents/com.voicy.test-worker.plist`, keeps
the worker alive, logs to `~/Library/Logs/voicy/`, and sets `PATH` to include
Homebrew locations before `/usr/bin:/bin`. Override `VOICY_WORKER_LAUNCHD_LABEL`
when running more than one local test worker.

Runtime health check:

```sh
MONGO=mongodb://127.0.0.1:27017/voicy yarn test:local-runtime-health
```

The check reports:

- bot process presence, controlled by `VOICY_BOT_PROCESS_PATTERN`;
- worker process presence, controlled by `VOICY_WORKER_PROCESS_PATTERN`;
- launchd label state, controlled by `VOICY_WORKER_LAUNCHD_LABEL`;
- Whisper command resolution and missing Homebrew `PATH` entries;
- Mongo ping, transcription job status counts, and the five newest jobs.

Live Telegram verification:

1. Start or verify the local bot runtime and Mongo.
2. Start or restart the worker LaunchAgent.
3. Send a new voice message to the test bot.
4. Run `MONGO=mongodb://127.0.0.1:27017/voicy yarn test:local-runtime-health`.
5. Confirm the newest `transcriptionjobs` entry reaches `completed`.
6. Confirm Telegram receives the final transcript reply for that voice message.
