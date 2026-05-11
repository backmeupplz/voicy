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
- Telegram Bot API server binary from `tdlib/telegram-bot-api`; build it on
  the worker host as described below.

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

Use `VOICY_WORKER_MODEL` as the worker-level model selector. The worker passes
that value to transcription argv entries through the `{model}` placeholder,
exports it to child processes as `VOICY_WORKER_MODEL`, and records it in result
metadata. If unset, the worker defaults to `large-v3`, which is the recommended
quality-first model for the RTX 4070 Ti host. Use smaller models only when the
machine cannot meet memory or latency needs.

Recommended starting points:

- RTX 4070 Ti / CUDA: `VOICY_WORKER_MODEL=large-v3`, `compute_type=float16`.
- Lower VRAM GPU: try `medium`, then `small` if jobs are too slow or fail.
- CPU or smoke-test workers: use `small`, `base`, or `tiny`; these are for
  validation speed, not production quality.

The checked-in `scripts/whisper-transcriber.js` adapter can run the local OpenAI
Whisper CLI directly and emit the worker JSON format. For the Windows GPU host
you can keep using a custom `faster-whisper` Python command if that is faster,
as long as it writes this same JSON shape to `{output}`.

Example `C:\voicy-worker\transcribe.py` for `faster-whisper`:

```python
import json
import sys
from faster_whisper import WhisperModel

input_path = sys.argv[1]
output_path = sys.argv[2]
language = sys.argv[3] or None
model_name = sys.argv[4] if len(sys.argv) > 4 else "large-v3"

model = WhisperModel(model_name, device="cuda", compute_type="float16")
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
        "model": model_name,
        "device": "cuda",
        "computeType": "float16",
    },
}

with open(output_path, "w", encoding="utf-8") as output:
    json.dump(result, output, ensure_ascii=False)
```

## Local Telegram Bot API

Run the Telegram Bot API server on the Windows worker host so worker-side
downloads are not limited by Telegram cloud Bot API's 20 MB file download cap.
Keep the Telegram API ID/hash and bot token out of the repo and outside task
comments.

Recommended production layout on `backm@borodutch-pc`:

- `C:\voicy-worker\telegram-bot-api\telegram-bot-api.exe` - server binary.
- `C:\ProgramData\Voicy\telegram-bot-api\telegram-bot-api.env` - local API
  ID/hash and server paths, ACLed to SYSTEM, Administrators, and the installing
  user.
- Scheduled task `VoicyLocalTelegramBotApi` - starts at boot as SYSTEM and
  restarts after failures.
- Scheduled task `VoicyWorker4070Ti` - runs
  `scripts/run-windows-worker.ps1`, restarts after failures, and points at
  `http://127.0.0.1:8081` through `VOICY_WORKER_TELEGRAM_API_URL`.

The official Telegram Bot API project does not publish Windows release
binaries. On the Windows worker, build it from source once and keep the output
under `C:\voicy-worker\telegram-bot-api`:

```powershell
winget install --id Kitware.CMake -e --source winget --accept-package-agreements --accept-source-agreements
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --source winget `
  --accept-package-agreements --accept-source-agreements `
  --override "--quiet --wait --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"

git clone --recursive https://github.com/tdlib/telegram-bot-api.git C:\voicy-worker\telegram-bot-api-src
cd C:\voicy-worker\telegram-bot-api-src
git clone https://github.com/Microsoft/vcpkg.git
.\vcpkg\bootstrap-vcpkg.bat
.\vcpkg\vcpkg.exe install gperf:x64-windows openssl:x64-windows zlib:x64-windows

mkdir build
cd build
cmake -A x64 `
  -DCMAKE_INSTALL_PREFIX:PATH=C:\voicy-worker\telegram-bot-api `
  -DCMAKE_TOOLCHAIN_FILE:FILEPATH=C:\voicy-worker\telegram-bot-api-src\vcpkg\scripts\buildsystems\vcpkg.cmake `
  ..
cmake --build . --target install --config Release
Copy-Item C:\voicy-worker\telegram-bot-api\bin\* C:\voicy-worker\telegram-bot-api\ -Force
C:\voicy-worker\telegram-bot-api\telegram-bot-api.exe --help
```

Install or refresh the local Bot API scheduled task from an elevated PowerShell
prompt on the Windows host:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-windows-telegram-bot-api.ps1 `
  -TelegramBotApiExe "C:\voicy-worker\telegram-bot-api\telegram-bot-api.exe" `
  -ApiId "<telegram-api-id>" `
  -ApiHash "<telegram-api-hash>" `
  -InstallRoot "C:\voicy-worker\telegram-bot-api" `
  -SecretDir "C:\ProgramData\Voicy\telegram-bot-api" `
  -TaskName "VoicyLocalTelegramBotApi" `
  -Port 8081 `
  -Start
```

The installer copies `scripts/run-windows-telegram-bot-api.ps1` into the install
root, writes the secret env file outside the repo, ACLs it, and registers the
scheduled task. It does not store the bot token; the worker still reads the bot
token from `VOICY_WORKER_TELEGRAM_BOT_TOKEN` or `TOKEN`.

Health check from the Windows host:

```powershell
Get-ScheduledTask -TaskName VoicyLocalTelegramBotApi | Select-Object TaskName,State
Invoke-RestMethod "http://127.0.0.1:8081/bot$env:VOICY_WORKER_TELEGRAM_BOT_TOKEN/getMe"
```

If the Bot API server cannot bind to `127.0.0.1:8081`, stop any old instance and
restart the task:

```powershell
Stop-ScheduledTask -TaskName VoicyLocalTelegramBotApi
Start-ScheduledTask -TaskName VoicyLocalTelegramBotApi
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
$env:VOICY_WORKER_RESTART_DELAY_MS = "10000"
$env:VOICY_WORKER_TELEGRAM_BOT_TOKEN = "<telegram-bot-token>"
$env:VOICY_WORKER_TELEGRAM_API_URL = "http://127.0.0.1:8081"
$env:VOICY_WORKER_DOWNLOAD_CONCURRENCY = "2"
$env:VOICY_WORKER_TRANSCRIPTION_CONCURRENCY = "1"
$env:VOICY_WORKER_TRANSCRIBE_EXECUTABLE = "C:\voicy-worker\.venv\Scripts\python.exe"
$env:VOICY_WORKER_TRANSCRIBE_ARGS_JSON = '["C:\\voicy-worker\\transcribe.py","{input}","{output}","{language}","{model}"]'
```

`VOICY_WORKER_TELEGRAM_API_URL` may point at a worker-local Telegram Bot API
server. Leave it unset to use `https://api.telegram.org`. The token is read from
`VOICY_WORKER_TELEGRAM_BOT_TOKEN` or `TOKEN` on the worker host and is not
persisted in queued job URLs.

For production large-file support, the backend defaults to
`VOICY_MAX_MEDIA_FILE_SIZE_MB=2048`, matching Telegram local Bot API's larger
download ceiling. Set a lower value accepted by local disk capacity if needed.
Cloud-only deployments should explicitly set `VOICY_MAX_MEDIA_FILE_SIZE_MB=20`
to reject larger media before workers try to download it through Telegram's
cloud Bot API.

For CPU or smoke-test environments with the OpenAI Whisper CLI installed, use the checked-in adapter instead:

```powershell
$env:VOICY_WHISPER_MODEL = "small"
$env:VOICY_WHISPER_COMMAND = "C:\Users\<user>\AppData\Local\Programs\Python\Python311\Scripts\whisper.exe"
$env:VOICY_WORKER_ENGINE = "openai-whisper-cli"
$env:VOICY_WORKER_MODEL = "small"
$env:VOICY_WORKER_TRANSCRIBE_EXECUTABLE = "node"
$env:VOICY_WORKER_TRANSCRIBE_ARGS_JSON = '["scripts/whisper-transcriber.js","{input}","{output}","{language}"]'
```

`VOICY_WHISPER_COMMAND` is optional when `whisper` is already on `PATH`, but it
is the safest service/launchd setting because non-interactive environments often
have a smaller `PATH` than an interactive terminal. On macOS/Homebrew test
hosts, the adapter also appends `/opt/homebrew/bin` and `/usr/local/bin` when it
spawns `whisper`, which protects the local test worker from launchd's default
`PATH=/usr/bin:/bin`.

Optional:

- `VOICY_WORKER_LANGUAGE=en` forces a language when the queued job has no hint.
- `VOICY_WORKER_IDLE_EXIT=1` processes one available batch and exits, useful for
  smoke tests or scheduled runs.
- `VOICY_WORKER_DOWNLOAD_TIMEOUT_MS=300000` controls audio download timeout.
- `VOICY_WORKER_RESTART_DELAY_MS=10000` controls how long the long-running
  worker waits before restarting its polling loop after an unexpected crash.
- `VOICY_WORKER_DOWNLOAD_CONCURRENCY=2` controls parallel media downloads.
- `VOICY_WORKER_TRANSCRIPTION_CONCURRENCY=1` controls concurrent local STT
  commands.
- `VOICY_MAX_MEDIA_FILE_SIZE_MB=2048` controls the bot-side accepted Telegram
  media size before a job is queued. This is the backend default for local Bot
  API workers; set `20` on cloud-only deployments.

Run the worker:

```powershell
yarn worker:run
```

For a smoke test, add `VOICY_WORKER_IDLE_EXIT=1` before running the worker. The
process exits after one available batch, or exits immediately if no queued job is
available.

## Windows Auto-Restart Setup

Production Windows workers should run through the checked-in scheduled-task
wrapper instead of a loose terminal window. The wrapper starts `yarn worker:run`,
logs startup/shutdown/crash events to `C:\voicy-worker\logs`, and restarts the
worker command after non-zero exits. The scheduled task is the outer guard: if
PowerShell itself, Node, or the host kills the wrapper, Task Scheduler starts it
again.

From an elevated PowerShell prompt in the repo, export the same worker
environment used above, then install or refresh the task:

```powershell
$env:VOICY_WORKER_API_URL = "https://<voicy-host>/worker/v1"
$env:VOICY_WORKER_TOKEN = "voicy_worker_..."
$env:VOICY_WORKER_WORK_DIR = "C:\voicy-worker\jobs"
$env:VOICY_WORKER_ENGINE = "faster-whisper"
$env:VOICY_WORKER_MODEL = "large-v3"
$env:VOICY_WORKER_RESTART_DELAY_MS = "10000"
$env:VOICY_WORKER_TELEGRAM_BOT_TOKEN = "<telegram-bot-token>"
$env:VOICY_WORKER_TELEGRAM_API_URL = "http://127.0.0.1:8081"
$env:VOICY_WORKER_DOWNLOAD_CONCURRENCY = "2"
$env:VOICY_WORKER_TRANSCRIPTION_CONCURRENCY = "1"
$env:VOICY_WORKER_TRANSCRIBE_EXECUTABLE = "C:\voicy-worker\.venv\Scripts\python.exe"
$env:VOICY_WORKER_TRANSCRIBE_ARGS_JSON = '["C:\\voicy-worker\\transcribe.py","{input}","{output}","{language}","{model}"]'

powershell -ExecutionPolicy Bypass -File .\scripts\install-windows-worker.ps1 `
  -InstallRoot "C:\voicy-worker" `
  -SecretDir "C:\ProgramData\Voicy\worker" `
  -TaskName "VoicyWorker4070Ti" `
  -Start
```

The installer copies `scripts/run-windows-worker.ps1` to the install root,
writes `C:\ProgramData\Voicy\worker\worker.env`, ACLs that env file to SYSTEM,
Administrators, and the installing user, and registers a restartable scheduled
task that runs as SYSTEM. Re-run the installer after changing worker environment
variables or after pulling updates to the wrapper script. If the transcription
stack depends on the installing user's profile instead of explicit paths under
`C:\voicy-worker`, pass `-RunAsCurrentUser` and verify the task still starts
after login.

Verify the task and logs:

```powershell
Get-ScheduledTask -TaskName VoicyWorker4070Ti | Select-Object TaskName,State
Get-Content C:\voicy-worker\logs\worker-supervisor-$(Get-Date -Format yyyyMMdd).log -Tail 40
```

To restart after an update:

```powershell
Stop-ScheduledTask -TaskName VoicyWorker4070Ti
Start-ScheduledTask -TaskName VoicyWorker4070Ti
```

## Runtime Behavior

The client polls `POST /jobs/claim-download`. If there is no work, it sleeps for
`VOICY_WORKER_POLL_INTERVAL_MS`. If an unexpected API, scheduler, or processing
error escapes a polling cycle, the long-running worker logs the redacted error
with `crashCount`, waits `VOICY_WORKER_RESTART_DELAY_MS`, and starts polling
again. Smoke-test runs with `VOICY_WORKER_IDLE_EXIT=1` still fail fast so broken
setup is visible. Configuration errors happen before the worker loop starts and
exit non-zero so the scheduled-task supervisor can detect them.

For each claimed job it:

1. Reads source metadata from `GET /jobs/:id/source`.
2. Resolves Telegram `fileId`/`filePath` through the configured Telegram Bot API
   endpoint when no legacy `sourceUrl` is present.
3. Downloads the media into `VOICY_WORKER_WORK_DIR`.
4. Marks the job `ready` with `POST /jobs/:id/downloaded`.
5. Starts transcription with `POST /jobs/:id/transcribe`.
6. Runs `VOICY_WORKER_TRANSCRIBE_EXECUTABLE` with
   `VOICY_WORKER_TRANSCRIBE_ARGS_JSON`.
7. Reads transcript JSON from `{output}` or plain text from stdout.
8. Uploads the result to `POST /jobs/:id/result`.

Downloads run up to `VOICY_WORKER_DOWNLOAD_CONCURRENCY` in parallel. The
transcription scheduler consumes whichever download becomes ready first, so a
large slow file does not block a later smaller file that has already reached
local disk.

`VOICY_WORKER_TRANSCRIBE_ARGS_JSON` must be a JSON array of argument strings.
Each argument may contain `{input}`, `{output}`, `{language}`, and `{model}`.
The worker replaces those placeholders and then starts the executable with an
argv array, without a shell. That preserves spaces, quotes, dollar signs,
backticks, and parentheses in paths and prevents shell expansion.
`scripts/whisper-transcriber.js` reads `VOICY_WORKER_MODEL` directly, so it does
not need `{model}` in the args array.

The worker logs transcription activity without tokens or source URLs. For each
job, the Windows service log includes command start, command completion, result
upload, and final completion lines with `jobId`, `chatId`, `telegramChatId`,
`sourceKind`, file size, requested/detected language, attempt count, local
input/output file names, elapsed command time, text character count,
empty-result status, part count, and optional audio duration. The final
completion line also includes `transcriptionResult` with the completed
transcript text; empty/no-speech results are logged as
`transcriptionResult=""` with `emptyResult=true`. Use these lines to confirm
that the Windows host is actively transcribing and uploading results while
keeping media URLs, worker tokens, and raw audio out of logs. Token-like secrets
inside transcript text are redacted before writing to the console or log file.

For persistent Windows Task Scheduler logs, run `yarn worker:run` from a
PowerShell wrapper that redirects standard output and error to a local file the
worker account can write, for example:

```powershell
$log = "C:\voicy-worker\logs\worker-$(Get-Date -Format yyyyMMdd).log"
yarn worker:run *>> $log
```

Rotate or prune `C:\voicy-worker\logs` with the same operational policy as the
worker job directory.

The checked-in worker client uploads the final result after the command exits.
Streaming-capable custom workers may call `POST /jobs/:id/progress` while a
transcription command emits stable segments, then must still call
`POST /jobs/:id/result` with the final transcript. Voicy stores accepted partial
payloads and throttles visible Telegram edits server-side.

## Retry and Error Behavior

Download failures, command crashes, and upload failures are reported to
`POST /jobs/:id/failure` with `retryable: true`. The backend requeues retryable
jobs for download until `VOICY_WORKER_MAX_ATTEMPTS` is reached, then marks them
failed.

Unexpected worker loop crashes do not exit the production worker process. The
client logs `Worker loop crashed; restarting...` with a crash count, waits
`VOICY_WORKER_RESTART_DELAY_MS`, and resumes polling. The PowerShell supervisor
logs process exits, repeated failures within a rolling window, and restart
backoff. Use the Windows scheduled task restart settings as the outer guard for
host reboots, Node process termination, or machine-level failures.

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
VOICY_WORKER_MODEL=base yarn test:worker-local-stt
MONGO=mongodb://127.0.0.1:27017/voicy_worker_proof yarn test:worker-e2e
```

`yarn test:worker-client` runs the compiled client against a mock worker API,
downloads a fake audio payload, executes a fake transcriber, uploads the result,
checks the no-work polling path, checks retryable command failure reporting, and
proves a smaller ready download can transcribe before a slower earlier download.

`yarn test:worker-e2e` uses the real Express worker API, local Mongo, a queued
`TranscriptionJob`, a local sample-audio HTTP server, and the worker client. It
disables Telegram network publishing with `VOICY_DISABLE_TELEGRAM_PUBLISH=1`,
but still verifies that the completed job creates the final `Voice` record.

End-to-end validation needs a deployed Voicy backend with Mongo, Telegram token,
and a real worker token. Send or enqueue a sample Telegram voice message, start
the Windows worker, and verify the Telegram status message is replaced with the
final transcript after the worker submits the result.

Large-file production QA:

1. Verify `VoicyLocalTelegramBotApi` is running on `backm@borodutch-pc`.
2. Verify `VoicyWorker4070Ti` has `VOICY_WORKER_TELEGRAM_API_URL=http://127.0.0.1:8081`.
3. Verify the backend has `VOICY_MAX_MEDIA_FILE_SIZE_MB` set above the test
   file size.
4. Send or replay a supported audio/video/audio-file larger than 20 MB.
5. Confirm worker logs show claim/download/transcribe/result without bot tokens,
   source URLs with Telegram file tokens, raw audio contents, or full
   transcripts.
6. Confirm the Telegram chat receives the final transcript.

Worker auto-restart QA:

1. Verify `VoicyWorker4070Ti` is running with `Get-ScheduledTask`.
2. Confirm `C:\voicy-worker\logs\worker-supervisor-<date>.log` includes
   `Supervisor starting worker task` and `Starting yarn worker:run`.
3. Kill the Node worker child process from Task Manager or PowerShell. Expected:
   the supervisor log records `Worker crashed exitCode=...` and then another
   `Starting yarn worker:run` after the configured delay.
4. Kill the PowerShell wrapper process or end the scheduled task process tree.
   Expected: Task Scheduler restarts it according to the task recovery settings.
5. Submit or replay a supported voice/audio message after the restart. Expected:
   the worker claims the queued job and the Telegram chat receives the final
   transcript.
6. For repeated-failure visibility, temporarily point
   `VOICY_WORKER_TRANSCRIBE_EXECUTABLE` at a missing executable, reinstall the
   task env, and observe repeated `Worker crashed` lines plus the threshold log.
   Restore the real executable and reinstall before leaving the host.

## macOS Test Bot LaunchAgent

The local test bot on Nikita's Mac can use the same worker client under launchd.
Build the repo, export the worker environment, and print the generated plist:

```sh
yarn build-ts
export VOICY_WORKER_API_URL=http://127.0.0.1:3000/worker/v1
export VOICY_WORKER_TOKEN=voicy_worker_...
export VOICY_WORKER_TRANSCRIBE_EXECUTABLE="$(command -v node)"
export VOICY_WORKER_TRANSCRIBE_ARGS_JSON='["scripts/whisper-transcriber.js","{input}","{output}","{language}"]'
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
