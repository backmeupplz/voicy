# Voicy Worker API

Worker clients authenticate with `Authorization: Bearer <token>`. Tokens are
stored in Mongo only as SHA-256 hashes in `WorkerClient`.

Create a token after building the TypeScript output:

```sh
yarn build-ts
MONGO='mongodb://...' yarn worker:create-client windows-4070-ti
```

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

### `POST /jobs/:id/result`

Completes a processing job owned by the authenticated worker, stores transcript
data, creates a legacy `Voice` record, and publishes the final transcript unless
`VOICY_DISABLE_TELEGRAM_PUBLISH=1`.

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
- result upload completes the job and persists transcript data;
- retryable failure requeues while attempts remain.
