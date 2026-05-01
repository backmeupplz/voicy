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
- Local or PR Voicy bot running with a test bot token.
- Mongo available to inspect `chats`, `transcriptionjobs`, and `voices`.
- A worker token created with `yarn worker:create-client`.
- A worker running with `VOICY_WORKER_IDLE_EXIT=1` for each sample message.

Path:

1. Open the test bot in a private chat.
2. Send `/start`.
3. Send `/help`.
4. Send `/donate` from an unpaid chat.
5. Send a short voice message while unpaid.
6. Mark the test chat paid in Mongo, then send the same voice message again.
7. Run the worker against the local or PR backend.

Expected result:

- `/start` and `/help` explain queued transcription and mention
  `@voicy_legacy_bot`.
- `/donate` and the unpaid voice-message response frame payment as funding
  transcription compute.
- The paid voice message creates one queued `TranscriptionJob`.
- Telegram shows the queued acknowledgement.
- Worker claim changes the job to `processing`.
- Progress edits are visible only if the worker/transcriber submits
  `POST /worker/v1/jobs/:id/progress` updates.
- Final worker result edits the acknowledgement to the transcript, and Mongo has
  a completed `TranscriptionJob` plus a completed `Voice` record.

## Group Chat

Path:

1. Add the test bot to a test group.
2. Run `/transcribeAll` until the bot says it will transcribe all audio.
3. Send a voice message as a regular group message.
4. Reply to a different voice message with `/transcribe`.
5. Toggle `/silent`, then repeat one queued-transcription path.

Expected result:

- Group messages are ignored only when `transcribeAllAudio` is false.
- With `transcribeAllAudio` enabled, a group voice message creates a queued job
  and replies to the source message.
- Reply `/transcribe` queues the replied-to voice/audio/document/video note.
- Silent mode suppresses optional noise but does not prevent queue creation.
- Worker completion publishes the transcript back into the group.

## Evidence To Capture

For Kaneo or PR review, capture:

- Commands and pass/fail output for every automated proof.
- Telegram screenshots for `/help`, donation wording, queued acknowledgement,
  any progress edit, and final transcript.
- Mongo document ids for the tested `TranscriptionJob` and `Voice`.
- Any worker logs showing claim, download, heartbeat, result, or failure.
- Follow-up Kaneo task links for defects that are outside the QA branch scope.
