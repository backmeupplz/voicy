[![Voicybot](/img/logo.png?raw=true)](https://voicybot.com/)

# [@voicybot](https://t.me/voicybot) main repository

This repository contains the code for one of the most popular bots I've ever built for Telegram — [@voicybot](https://t.me/voicybot). It automatically converts all the audio messages to text when added to a group chat. Please, feel free to fork, add features and create pull requests so that everybody (over 12 000 000 people) can experience the features you've built.

The active bot interface is maintained in English and Russian in the `locales` folder.

## List of repositories

- [voicy](https://github.com/backmeupplz/voicy) — the main [@voicybot](https://t.me/voicybot) code
- [voicy-payments](https://github.com/backmeupplz/voicy-payments) — payments service that used stripe to process payments for the Google Speech seconds of recognition; currently retired as the stats server for [voicybot.com](https://voicybot.com)
- [voicy-landing](https://github.com/backmeupplz/voicy-landing) — [borodutch.com](https://borodutch.com) landing page
- [voicy-recognition](https://github.com/backmeupplz/voicy-recognition/) — Recognition service for [voicybot.com](https://voicybot.com)

## Installation and local launch

1. Clone this repo: `git clone https://github.com/backmeupplz/voicy`
2. Launch a [mongo database](https://www.mongodb.com/) locally
3. Create `.env` file with the environment variables listed below
4. Install `ffmpeg` on machines that run local transcription workers
5. Run `yarn` in the root folder
6. Run `yarn start`

## Environment variables in `.env` file

| Variable      | Description                                                     |
| ------------- | --------------------------------------------------------------- |
| `MONGO`       | URI for the mongo database used                                 |
| `TOKEN`       | Telegram bot token                                              |
| `SALT`        | Random salt to generate various encrypted stuff                 |
| `ADMIN_ID`    | Chat id of the person who shall receive valuable logs           |
| `ENVIRONMENT` | App environment, can be `development`, defaults to `production` |

See examples in `.env.sample` file.

## Continuous integration

Any commit pushed to `main` gets deployed to [@voicybot](https://t.me/voicybot) via [CI Ninja](https://github.com/backmeupplz/ci-ninja).

## Windows GPU transcription worker

Voicy queues incoming Telegram audio in Mongo and expects one or more
authenticated worker clients to process those jobs. The Windows GPU worker is
the supported local setup for Nikita's RTX 4070 Ti machine: it polls the backend
worker API, downloads the queued audio source, runs a local transcription command
on CUDA, and uploads the final transcript back to Voicy.

The worker API is mounted at `/worker/v1` and requires
`Authorization: Bearer <VOICY_WORKER_TOKEN>` on every request. Create a worker
token from a trusted backend shell after building the TypeScript output:

```sh
yarn build-ts
MONGO='mongodb://...' yarn worker:create-client windows-4070-ti
```

Store the printed token only in the Windows worker environment as
`VOICY_WORKER_TOKEN`; the backend stores only its SHA-256 hash. If a token is
lost or exposed, create a replacement token and disable the old `WorkerClient`
record in Mongo by setting `enabled` to `false`.

On the Windows machine, build this repo, install FFmpeg, Node.js 20+, Python
3.11, current NVIDIA drivers, and a CUDA-capable transcription stack such as
`faster-whisper`. Configure the worker with:

```powershell
$env:VOICY_WORKER_API_URL = "https://<voicy-host>/worker/v1"
$env:VOICY_WORKER_TOKEN = "voicy_worker_..."
$env:VOICY_WORKER_WORK_DIR = "C:\voicy-worker\jobs"
$env:VOICY_WORKER_ENGINE = "faster-whisper"
$env:VOICY_WORKER_MODEL = "large-v3"
$env:VOICY_WORKER_TELEGRAM_BOT_TOKEN = "<telegram-bot-token>"
$env:VOICY_WORKER_TELEGRAM_API_URL = "http://127.0.0.1:8081"
$env:VOICY_WORKER_DOWNLOAD_CONCURRENCY = "2"
$env:VOICY_WORKER_TRANSCRIPTION_CONCURRENCY = "1"
$env:VOICY_WORKER_TRANSCRIBE_EXECUTABLE = "C:\voicy-worker\.venv\Scripts\python.exe"
$env:VOICY_WORKER_TRANSCRIBE_ARGS_JSON = '["C:\\voicy-worker\\transcribe.py","{input}","{output}","{language}","{model}"]'
yarn worker:run
```

Set `VOICY_MAX_MEDIA_FILE_SIZE_MB` on the backend to tune the largest Telegram
media message that Voicy will enqueue for local workers. For files above the
cloud Bot API download limit, run a local Telegram Bot API server on the worker
host and point `VOICY_WORKER_TELEGRAM_API_URL` at it; see
`docs/windows-worker-client.md` for the scheduled-task installer and validation
steps.

Production long polling deliberately drops Telegram's pending update backlog
before startup by default (`VOICY_DROP_PENDING_UPDATES_ON_STARTUP=true`). This
prevents old voice/audio messages from being replayed into new transcription
jobs after deploys, restarts, or downtime. Message updates are also ignored when
their Telegram `date` is older than the current bot process startup cutoff or
older than `VOICY_MAX_TELEGRAM_UPDATE_AGE_SECONDS` seconds, defaulting to 300.

Before restarting production, pause local transcription workers if there are
active claimable jobs, deploy/restart the bot, confirm logs include the pending
update drop, and then restart workers only after the backend is accepting fresh
updates. Operators should expect voice/audio messages sent while the bot was
down to be discarded rather than transcribed late.

The donation wall is temporarily disabled by default for testing. Leave
`VOICY_DONATION_WALL_ENABLED=false` unset or false to let unpaid chats enqueue
voice/audio transcription. Set `VOICY_DONATION_WALL_ENABLED=true` to re-enable
the paid-chat gate while keeping the Stripe `/donate` flow and webhook support
intact. When the wall is enabled, paid chats bypass the free allowance entirely.
Unpaid chats can still enqueue up to 50 lifetime free transcriptions per
Telegram user when the voice/audio sender is currently a member of
`@golden_borodutch`; Voicy checks that membership live with `getChatMember` and
fails closed if the bot cannot read the channel membership.

Stripe `/donate` uses Checkout Sessions with inline `price_data`, so no
dashboard Price IDs are required for Voicy donation tiers. Configure
`STRIPE_MINIMUM_AMOUNT=699`, `STRIPE_FIXED_AMOUNTS=699,999,1299,1599`,
`STRIPE_CURRENCY=usd`, and `STRIPE_WEBHOOK_SIGNING_SECRET`. Webhook activation
validates the signed Checkout session, chat metadata, currency, selected amount,
tier, and line item before marking only that chat as paid. Users can choose a
fixed tier from `/donate` or send `/donate 12.34` to pay another amount above
the minimum.

See [`docs/windows-worker-client.md`](docs/windows-worker-client.md) for the
full Windows setup, environment variables, retry behavior, and validation steps.
See [`docs/worker-api.md`](docs/worker-api.md) for the authenticated API
contract.

## Local macOS test worker

For the local test bot runtime, use the repo-supported LaunchAgent installer so
the worker is restarted by launchd with a full executable path. Build first,
export the worker API/token environment, then inspect the generated plist:

```sh
yarn build-ts
export VOICY_WORKER_API_URL=http://127.0.0.1:3000/worker/v1
export VOICY_WORKER_TOKEN=voicy_worker_...
export VOICY_WORKER_TRANSCRIBE_EXECUTABLE="$(command -v node)"
export VOICY_WORKER_TRANSCRIBE_ARGS_JSON='["scripts/whisper-transcriber.js","{input}","{output}","{language}"]'
yarn worker:print-macos-test-launchd
```

Load it after the output looks right:

```sh
yarn worker:install-macos-test-launchd
```

The generated LaunchAgent sets `PATH` to include `/opt/homebrew/bin` and
`/usr/local/bin`, and sets `VOICY_WHISPER_COMMAND` to the resolved `whisper`
executable when available. This avoids launchd failures such as
`spawn whisper ENOENT` when Homebrew is not present in the default launchd
environment.

Check the local bot, worker, Mongo, Whisper command, and queued job health with:

```sh
MONGO=mongodb://127.0.0.1:27017/voicy yarn test:local-runtime-health
```

For the live Telegram proof loop, send a fresh voice message to the test bot,
run the health check above, and verify in Mongo that the newest
`transcriptionjobs` document moves from `queued` to `processing` to `completed`.
The Telegram chat should receive the completed transcript reply after the worker
submits the result.

## License

MIT — use for any purpose. Would be great if you could leave a note about the original developers. Thanks!

## As seen on

[![Habrahabr](/img/habr.png?raw=true)](https://habrahabr.ru/post/316824/)
[![Spark](/img/spark.png?raw=true)](https://spark.ru/startup/voicy/blog/19008/kak-zapustit-proekt-v-odinochku/)
[![Reddit](/img/reddit.png?raw=true)](https://redd.it/5iduzy)
[![Bot Store](/img/bs.png?raw=true)](https://storebot.me/bot/voicybot)
[![Product Hunt](/img/ph.png?raw=true)](https://www.producthunt.com/posts/voicy)
