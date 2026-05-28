# Voicy Worker API

Worker clients authenticate with `Authorization: Bearer <token>`. Tokens are
stored in Mongo only as SHA-256 hashes in `WorkerClient`, and only enabled
clients are accepted.

Create a token from a trusted backend shell after building TypeScript:

```sh
yarn build-ts
MONGO='mongodb://...' yarn worker:create-client windows-4070-ti
```

Store the printed token as `VOICY_WORKER_TOKEN` on the worker host. The token is
not recoverable from Mongo; if it is lost or exposed, create a new token and
disable the old `WorkerClient` record by setting `enabled` to `false`.

The Windows worker client is documented in
[`docs/windows-worker-client.md`](windows-worker-client.md).

The worker API is not a public job-submission API. Voicy creates transcription
jobs from Telegram input, then authenticated workers can claim and complete only
the jobs they own.

## Endpoints

All endpoints are mounted under `/worker/v1`.

### `POST /jobs/claim-download`

Atomically claims the oldest `queued_for_download` job for the authenticated
worker. Legacy `queued` jobs are also accepted for migration. Returns `204`
when no download work is available.

Successful response:

```json
{
  "job": {
    "id": "665...",
    "status": "downloading",
    "sourceKind": "voice",
    "fileId": "AwAC...",
    "attempts": 1
  }
}
```

The Mongo update sets `status: downloading`, `workerId`, `claimedAt`,
`heartbeatAt`, and increments `attempts` in one `findOneAndUpdate`, so two
workers cannot claim the same media acquisition job.

### `GET /jobs/:id/source`

Returns source media metadata for an owned `downloading`, `ready`,
`transcribing`, or legacy `processing` job. New jobs expose Telegram `fileId`
and any known `filePath`; workers resolve and download the media locally instead
of relying on a bot-token-bearing persisted `sourceUrl`.

```json
{
  "source": {
    "jobId": "665...",
    "fileId": "AwAC...",
    "filePath": "voice/file_1.oga",
    "fileSize": 12345,
    "mimeType": "audio/ogg",
    "sourceKind": "voice"
  }
}
```

### `POST /jobs/:id/downloaded`

Marks an owned `downloading` job as `ready` after the worker has fully downloaded
the Telegram media to local disk.

```json
{
  "localSourcePath": "C:\\voicy-worker\\jobs\\665.ogg"
}
```

### `POST /jobs/:id/transcribe`

Marks an owned `ready` job as `transcribing`. Workers should call this only
after the local media file is fully available.

### `POST /jobs/claim-ready`

Claims a ready local file owned by the authenticated worker and marks it
`transcribing`. This endpoint is available for split downloader/transcriber
clients and for worker restart recovery. The request body may include
`{"bucket":"oldest"}` or `{"bucket":"newest"}` to choose the sort direction.
The endpoint can also reclaim same-worker `transcribing` or legacy `processing`
jobs when their heartbeat is stale, they have a stored `localSourcePath`, and
the worker needs to recover after an interrupted local run. The default stale
cutoff is 15 minutes and can be adjusted with
`VOICY_WORKER_STALE_ACTIVE_JOB_MS`.

The bundled worker normally calls `POST /jobs/:id/transcribe` for the job it
just downloaded, but it also polls `claim-ready` when a transcription slot is
free so ready jobs from an older local run are not stranded. Recovery claims
alternate between `oldest` and `newest` buckets so fresh ready jobs do not wait
for the whole stale ready backlog to drain.

### `POST /jobs/claim`

Backward-compatible transcription claim endpoint. It first claims an owned
`ready` job, then falls back to legacy `queued` jobs that still have a
`sourceUrl`. New workers should prefer `claim-download`.

### Token-bearing source URL cleanup

New jobs persist Telegram file metadata instead of Telegram file download URLs,
because `https://api.telegram.org/file/bot<TOKEN>/...` URLs contain the bot
token. Worker API responses also suppress any legacy `sourceUrl` that matches a
Telegram bot-token URL.

After deploying this code, scrub historical Mongo records before rotating the
Telegram bot token:

```sh
yarn build-ts
MONGO="$MONGO" yarn security:scrub-source-urls --dry-run
MONGO="$MONGO" yarn security:scrub-source-urls
```

The scrubber unsets token-bearing `TranscriptionJob.sourceUrl` and legacy
`Voice.url` values while leaving non-token source URLs untouched. Rotate `TOKEN`
after the scrubber reports no remaining matches.

### `GET /jobs/:id`

Returns metadata for an active job owned by the authenticated worker.

### `POST /jobs/:id/heartbeat`

Refreshes `heartbeatAt` for a `downloading`, `ready`, `transcribing`, or legacy
`processing` job owned by the authenticated worker.

### `POST /jobs/:id/progress`

Stores a partial transcript for a `transcribing` job owned by the authenticated
worker and edits the bot's in-chat status message when enough time has passed
since the last visible progress edit.

Request body:

```json
{
  "text": "Partial transcript produced so far",
  "parts": [{ "timeCode": "00:00", "text": "Partial transcript" }],
  "language": "en",
  "engine": "faster-whisper",
  "duration": 1.4,
  "metadata": { "model": "large-v3" }
}
```

Workers should call this endpoint only for meaningful transcript changes. The
server throttles visible Telegram edits with `VOICY_PROGRESS_EDIT_INTERVAL_MS`
(default `2500`, clamped to minimum `1000`) and stores every accepted progress
payload even when an edit is skipped. If a job has no editable status message,
progress is still stored and the final result will be sent as a normal message.
Voicy does not live-edit channel posts; channel jobs wait for final text until
channel edit behavior is explicitly verified.

### `POST /jobs/:id/result`

Completes a `transcribing` job owned by the authenticated worker, stores transcript
data, creates a legacy `Voice` record, and publishes the final transcript by
editing the status/progress message unless `VOICY_DISABLE_TELEGRAM_PUBLISH=1`.
Long final transcripts are split into follow-up replies after the first edited
message.

Request body:

```json
{
  "text": "Final transcript",
  "parts": [{ "timeCode": "00:00", "text": "Final transcript" }],
  "language": "en",
  "engine": "faster-whisper",
  "duration": 3.2,
  "metadata": { "model": "large-v3" }
}
```

### `POST /jobs/:id/failure`

Records worker failure. Retryable failures requeue the job while attempts remain
below `VOICY_WORKER_MAX_ATTEMPTS` (default `3`); otherwise the job is marked
`failed`.

Request body:

```json
{
  "error": "download timed out",
  "retryable": true
}
```

## Validation

`yarn test:worker-api` runs a scripted HTTP proof against `MONGO`. It verifies:

- missing authentication returns `401`;
- exactly one of two clients can claim a single queued download job;
- a non-owning client cannot heartbeat another worker's job;
- downloaded media moves the job to `ready` before transcription;
- progress upload stores partial transcript state for the owning worker;
- progress edit policy throttles rapid visible edits and disables live edits in
  channels;
- result upload completes the job and persists transcript data;
- retryable failure requeues while attempts remain.
