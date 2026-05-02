# Streaming Transcription Progress

Voicy supports partial transcript progress through the authenticated worker API
without requiring every worker engine to stream. Engines that only produce a
final transcript can continue to call `POST /worker/v1/jobs/:id/result`.

## Runtime Contract

1. Telegram media input creates a `TranscriptionJob` with `telegramChatType`,
   `statusMessageId` when an editable acknowledgement exists, and empty partial
   result fields.
2. When a worker claims a job, Voicy edits the acknowledgement to the localized
   processing text when publishing is enabled.
3. Streaming-capable workers can call `POST /worker/v1/jobs/:id/progress` with
   the current `text` and/or `parts`. Voicy stores every accepted progress
   payload on the job.
4. Voicy only edits the Telegram status message when the progress policy allows
   it. The default visible edit interval is 2500 ms and
   `VOICY_PROGRESS_EDIT_INTERVAL_MS` cannot lower it below 1000 ms.
5. Final `POST /worker/v1/jobs/:id/result` stores the completed transcript,
   creates the legacy `Voice` record, and edits the existing status/progress
   message when one exists. Long final transcripts are split into follow-up
   messages.

## Telegram Chat Policy

Private chats, groups, and supergroups can use live progress edits when the bot
has an editable status message. Channels do not use live progress edits:
channel jobs skip the queued acknowledgement, keep `statusMessageId` empty, and
publish only final text. This keeps channel behavior explicit until channel edit
rate limits and client behavior are verified separately.

## Worker Guidance

Workers should send progress only for meaningful transcript changes. Segmenting
STT engines can post the full draft-so-far text or accumulated `parts` after a
new segment is stable. The server handles Telegram edit throttling, but workers
should still avoid high-frequency progress calls because every accepted payload
is persisted.

The checked-in Windows worker remains final-result first. A worker adapter that
can stream should call the progress endpoint between heartbeat and final result
submission, then always call the result endpoint with the final transcript.
