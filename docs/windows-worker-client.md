# Windows Transcription Worker Client

This worker runs on Nikita's Windows RTX 4070 Ti machine. It claims queued
Voicy transcription jobs from the backend, downloads the Telegram audio file,
runs a local GPU transcription command, and uploads the final transcript.

## Backend Prep

Build the server code and create a worker token:

```sh
yarn build-ts
MONGO='mongodb://...' yarn worker:create-client windows-4070-ti
```

Store the printed token in the Windows worker environment as
`VOICY_WORKER_TOKEN`. The backend stores only its hash.

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

Create `C:\voicy-worker\transcribe.py`:

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
$env:VOICY_WORKER_API_URL = "https://voicy.example.com/worker/v1"
$env:VOICY_WORKER_TOKEN = "voicy_worker_..."
$env:VOICY_WORKER_WORK_DIR = "C:\voicy-worker\jobs"
$env:VOICY_WORKER_ENGINE = "faster-whisper"
$env:VOICY_WORKER_MODEL = "large-v3"
$env:VOICY_WORKER_HEARTBEAT_INTERVAL_MS = "30000"
$env:VOICY_WORKER_POLL_INTERVAL_MS = "5000"
$env:VOICY_WORKER_TRANSCRIBE_COMMAND = "C:\voicy-worker\.venv\Scripts\python.exe C:\voicy-worker\transcribe.py {input} {output} {language}"
```

Optional:

- `VOICY_WORKER_LANGUAGE=en` forces a language when the queued job has no hint.
- `VOICY_WORKER_IDLE_EXIT=1` processes at most one available job and exits,
  useful for smoke tests or scheduled runs.
- `VOICY_WORKER_DOWNLOAD_TIMEOUT_MS=300000` controls audio download timeout.

Run the worker:

```powershell
yarn worker:run
```

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
yarn test:worker-client
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
