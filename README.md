[![Voicybot](/img/logo.png?raw=true)](https://voicybot.com/)

# [@voicybot](https://t.me/voicybot) main repository

This repository contains the code for one of the most popular bots I've ever built for Telegram — [@voicybot](https://t.me/voicybot). It automatically converts all the audio messages to text when added to a group chat. Please, feel free to fork, add features and create pull requests so that everybody (over 12 000 000 people) can experience the features you've built.

You can also help by translating the bot to other languages or fixing some texts in existing languages by modifying the `locales` folder or at [localize.borodutch.com](https://localize.borodutch.com).

## List of repositories

- [voicy](https://github.com/backmeupplz/voicy) — the main [@voicybot](https://t.me/voicybot) code
- [voicy-payments](https://github.com/backmeupplz/voicy-payments) — payments service that used stripe to process payments for the Google Speech seconds of recognition; currently retired as the stats server for [voicybot.com](https://voicybot.com)
- [voicy-landing](https://github.com/backmeupplz/voicy-landing) — [borodutch.com](https://borodutch.com) landing page
- [voicy-recognition](https://github.com/backmeupplz/voicy-recognition/) — Recognition service for [voicybot.com](https://voicybot.com)

## Installation and local launch

1. Clone this repo: `git clone https://github.com/backmeupplz/voicy`
2. Launch a [mongo database](https://www.mongodb.com/) locally
3. Create `.env` file with the environment variables listed below
4. Install `ffmpeg` on your machine
5. Run `yarn` in the root folder
6. Run `yarn start`

## Environment variables in `.env` file

| Variable        | Description                                                     |
| --------------- | --------------------------------------------------------------- |
| `MONGO`         | URI for the mongo database used                                 |
| `TOKEN`         | Telegram bot token                                              |
| `SALT`          | Random salt to generate various encrypted stuff                 |
| `ADMIN_ID`      | Chat id of the person who shall receive valuable logs           |
| `WIT_LANGUAGES` | A map of language names to Wit.ai tokens                        |
| `ENVIRONMENT`   | App environment, can be `development`, defaults to `production` |

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
$env:VOICY_WORKER_TRANSCRIBE_COMMAND = "C:\voicy-worker\.venv\Scripts\python.exe C:\voicy-worker\transcribe.py {input} {output} {language}"
yarn worker:run
```

See [`docs/windows-worker-client.md`](docs/windows-worker-client.md) for the
full Windows setup, environment variables, retry behavior, and validation steps.
See [`docs/worker-api.md`](docs/worker-api.md) for the authenticated API
contract.

## License

MIT — use for any purpose. Would be great if you could leave a note about the original developers. Thanks!

## As seen on

[![Habrahabr](/img/habr.png?raw=true)](https://habrahabr.ru/post/316824/)
[![Spark](/img/spark.png?raw=true)](https://spark.ru/startup/voicy/blog/19008/kak-zapustit-proekt-v-odinochku/)
[![Reddit](/img/reddit.png?raw=true)](https://redd.it/5iduzy)
[![Bot Store](/img/bs.png?raw=true)](https://storebot.me/bot/voicybot)
[![Product Hunt](/img/ph.png?raw=true)](https://www.producthunt.com/posts/voicy)
