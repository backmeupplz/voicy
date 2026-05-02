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

### `POST /jobs/claim`

Atomically claims the oldest queued job for the authenticated worker. Returns
`204` when no work is available.

Successful response:

```json
{
  "job": {
    "id": "665...",
    "status": "processing",
    "sourceUrl": "https://api.telegram.org/file/...",
    "sourceKind": "voice",
    "fileId": "AwAC...",
    "attempts": 1
  }
}
```

The Mongo update filters on `status: queued` and sets `status: processing`,
`workerId`, `claimedAt`, and `heartbeatAt` in one `findOneAndUpdate`, so two
workers cannot claim the same queued job.

### `GET /jobs/:id`

Returns metadata for a processing job owned by the authenticated worker.

### `GET /jobs/:id/source`

Returns the source audio metadata and URL for a processing job owned by the
authenticated worker.

### `POST /jobs/:id/heartbeat`

Refreshes `heartbeatAt` for a processing job owned by the authenticated worker.

### `POST /jobs/:id/progress`

Stores a partial transcript for a processing job owned by the authenticated
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

Completes a processing job owned by the authenticated worker, stores transcript
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
- exactly one of two clients can claim a single queued job;
- a non-owning client cannot heartbeat another worker's job;
- progress upload stores partial transcript state for the owning worker;
- progress edit policy throttles rapid visible edits and disables live edits in
  channels;
- result upload completes the job and persists transcript data;
- retryable failure requeues while attempts remain.
