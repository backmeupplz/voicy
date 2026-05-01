# Voicy vNext QA Checklist

Use a feature branch or PR build for this checklist. Do not run this QA against
`main` unless the branch has already been merged and the release itself is being
verified.

## Automated Proofs

Run these from the repo root:

```sh
yarn install --frozen-lockfile
yarn build-ts
yarn lint
MONGO=mongodb://127.0.0.1:27017/voicy_kaneo_7_worker_api yarn test:worker-api
yarn test:worker-client
MONGO=mongodb://127.0.0.1:27017/voicy_kaneo_7_worker_e2e yarn test:worker-e2e
MONGO=mongodb://127.0.0.1:27017/voicy_kaneo_7_qa yarn test:qa-vnext
```

`test:qa-vnext` downloads a real public WAV speech sample from the
free-spoken-digit-dataset, serves it as a queued Telegram voice source, runs the
worker client against the local worker API, and verifies the completed
`TranscriptionJob` plus legacy `Voice` record.

## Private Chat

Environment:

- Telegram Web or desktop Telegram already logged in on this Mac.
- For repeatable Telegram Web upload proof, use the CDP helper documented in
  `docs/telegram-web-upload-qa.md`.
- Local Voicy test bot runtime running with the `@okamikron_bot` token. The
  test bot is expected to be a local long-polling process for QA, not a Telegram
  webhook service.
- Mongo available to inspect `chats`, `transcriptionjobs`, and `voices`.
- A worker token created with `yarn worker:create-client`.
- A worker running with `VOICY_WORKER_IDLE_EXIT=1` for each sample message.

Before testing bot copy, verify the runtime is actually consuming Telegram
updates:

```sh
TELEGRAM_TEST_BOT_TOKEN=... TELEGRAM_TEST_BOT_USERNAME=okamikron_bot yarn test:telegram-runtime
```

The check is non-destructive: it only reads `getWebhookInfo` and does not call
`getUpdates`, because a second `getUpdates` caller can interrupt the local
polling runtime. It passes when Telegram reports an active webhook or no pending
backlog. If it reports pending updates and no webhook, start the local bot
runtime first:

```sh
yarn build-ts
MONGO=mongodb://127.0.0.1:27017/voicy_telegram_qa TOKEN=... SALT=telegram-qa ADMIN_ID=0 ENVIRONMENT=development yarn distribute
```

Path:

1. Open the test bot in a private chat.
2. Send `/start`.
3. Send `/help`.
4. Send `/donate` from an unpaid chat.
5. Send a short voice message while unpaid.
6. Mark the test chat paid in Mongo, then send the same voice message again.
7. Run the worker against the local or PR backend.

For unattended Telegram Web upload QA, replace the manual voice send with:

```sh
yarn qa:telegram-upload \
  --browser-url http://127.0.0.1:9222 \
  --chat @okamikron_bot \
  --sample \
  --caption "Voicy private audio QA $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --expected-text "Turning into text" \
  --send \
  --timeout-ms 180000 \
  --evidence-file tmp/telegram-upload-private.json \
  --screenshot-file tmp/telegram-upload-private.png \
  --json
```

Expected result:

- `/start` and `/help` explain that Voicy turns voice messages into text and mention
  `@voicy_legacy_bot`.
- `/donate` and the unpaid voice-message response frame payment as helping Voicy
  turn voice messages into text.
- The paid voice message creates one pending `TranscriptionJob`.
- Telegram shows the `Turning into text...` acknowledgement.
- Worker claim changes the job to `processing`.
- Progress edits are visible only if the worker/transcriber submits
  `POST /worker/v1/jobs/:id/progress` updates.
- Final worker result edits the acknowledgement to the transcript, and Mongo has
  a completed `TranscriptionJob` plus a completed `Voice` record.

## Group Chat

Path:

1. Add the test bot to a test group.
2. Run `/transcribe_all` until the bot says it will transcribe all audio.
3. Send a voice message as a regular group message.
4. Reply to a different voice message with `/transcribe`.
5. Toggle `/silent`, then repeat one voice-to-text path.

For unattended Telegram Web upload QA in a group where the bot is already
present and configured, use the group chat URL or handle:

```sh
yarn qa:telegram-upload \
  --browser-url http://127.0.0.1:9222 \
  --chat "https://web.telegram.org/k/#-123456789" \
  --sample \
  --caption "Voicy group audio QA $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --expected-text "Turning into text" \
  --send \
  --timeout-ms 180000 \
  --evidence-file tmp/telegram-upload-group.json \
  --screenshot-file tmp/telegram-upload-group.png \
  --json
```

Expected result:

- Group messages are ignored only when `transcribeAllAudio` is false.
- With `transcribeAllAudio` enabled, a group voice message creates a pending job
  and replies to the source message.
- Reply `/transcribe` starts turning the replied-to voice/audio/document/video note into text.
- Silent mode suppresses optional noise but does not prevent job creation.
- Worker completion publishes the transcript back into the group.

## Evidence To Capture

For Kaneo or PR review, capture:

- Commands and pass/fail output for every automated proof.
- Telegram screenshots for `/help`, donation wording, the `Turning into text...` acknowledgement,
  any progress edit, and final text.
- Telegram upload helper JSON/screenshot evidence for private-chat and group
  audio/file sends when CDP upload QA is used.
- Mongo document ids for the tested `TranscriptionJob` and `Voice`.
- Any worker logs showing claim, download, heartbeat, result, or failure.
- Follow-up Kaneo task links for defects that are outside the QA branch scope.
