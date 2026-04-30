# Voicy vNext Queued Transcription Plan

This document is the repo audit and implementation plan for redesigning Voicy
from an inline speech-recognition bot into a queued transcription system served
by one or more authenticated worker clients.

## Current Repo Audit

### Runtime entrypoint

- `src/app.ts` starts Mongo, installs grammY middleware, registers Telegram
  handlers, starts the bot runner, and starts a small Express app on port 4242.
- Telegram voice-like inputs are registered in `src/app.ts`:
  `:voice`, `:video_note`, `:audio`, and `:document` route into
  `src/handlers/handleAudio.ts`.
- The same process also handles Stripe checkout webhooks through
  `src/helpers/startWebhook.ts`.

### Inline transcription flow

The legacy transcription path is synchronous from the user's perspective:

1. `src/handlers/handleAudio.ts` enforces the donation wall, group
   `transcribeAllAudio` behavior, audio size limit, Telegram file lookup, and
   progress/error replies.
2. `src/handlers/handleAudio.ts` calls `sendTranscription`, which edits the
   progress message after recognition and persists the final `Voice` record.
3. `src/helpers/urlToText.ts` fans work out to Node cluster workers, downloads
   the Telegram file URL, converts it to FLAC with `src/helpers/flac.ts`, calls
   engine recognition, then deletes local temp files.
4. `src/helpers/getTextFromAudio.ts` selects an engine from `src/engines` using
   `chat.engine`.
5. `src/engines/*.ts` call third-party recognition services directly from this
   bot/backend process: Wit.ai, Google Speech, Nanosemantics, and Platinum Fund.
6. `src/models/Voice.ts` stores the finished transcript metadata after the
   engine has returned.

This means the bot process owns queueing by process memory only, file download,
audio conversion, engine credentials, third-party transcription calls, result
formatting, and Telegram delivery.

### Current data model

- `src/models/Chat.ts` stores both product settings and engine-specific
  transcription settings:
  `engine`, `googleKey`, `googleSetupMessageId`, `witToken`,
  `timecodesEnabled`, and a `languages` map keyed by engine.
- `src/models/Voice.ts` stores completed transcription records only. It has no
  queued, claimed, processing, failed, retry, or worker ownership state.
- `src/models/PromoException.ts` exists for promo behavior, but
  `src/helpers/addPromoToText.ts` currently returns text unchanged.
- `src/models/MessageStats.ts` tracks usage counts separately from the
  transcription result path.

### Current language and engine behavior

- `/engine` is implemented by `src/commands/handleEngine.ts`, with callback
  handling in `src/handlers/handleSetEngine.ts`.
- `/language` and `/l` currently select a recognition language for the active
  recognition engine through `src/commands/handleLanguage.ts`,
  `src/commands/handleL.ts`, `src/helpers/language/sendLanguage.ts`,
  `src/helpers/language/languageKeyboard.ts`, and
  `src/handlers/handleSetLanguage.ts`.
- `src/middlewares/configureI18n.ts` derives the bot UI locale from the active
  engine language, which couples localization to transcription settings.
- `src/helpers/language/setLanguageCodeFromTelegram.ts` seeds every engine's
  language from Telegram's user language code and switches Russian users to the
  Nanosemantics engine.

The vNext requirement reverses this: language selection should affect only bot
UI localization. It should not select a transcription engine or recognition
language.

### Donation and copy touchpoints

- Donation gating is enforced in `src/handlers/handleAudio.ts` and
  `src/commands/handleTranscribe.ts` through the `sunsetting` locale key.
- Checkout creation lives in `src/commands/handleDonate.ts`; payment completion
  flips `Chat.paid` in `src/helpers/startWebhook.ts`.
- Primary copy lives in `locales/*.yaml`; the English and Russian files still
  mention engine selection, Google setup, Wit tokens, recognition language, and
  the old sunsetting donation framing.

### API and worker surface

- The only HTTP surface today is the Stripe webhook in
  `src/helpers/startWebhook.ts`.
- There is no authenticated worker API, job model, durable queue, heartbeat, job
  claim lock, or result upload path.
- There is no Windows worker package or documentation in this repo.

## Architecture Delta

### Legacy

- Bot receives audio and transcribes inline.
- Recognition engines are selected per chat.
- Recognition language is selected per engine.
- Bot process downloads, converts, transcribes, formats, and stores the final
  transcript.
- Cluster workers provide local concurrency, but no durable queue survives a
  process restart.
- Completed `Voice` records are the only transcription persistence layer.

### vNext

- Bot receives audio and creates a durable `TranscriptionJob`.
- Bot immediately acknowledges the queued job in Telegram and stores the
  Telegram message ids needed for later edits/replies.
- Worker clients authenticate with server-issued credentials, poll/claim queued
  jobs, download source audio, transcribe locally, and upload results.
- The backend enforces job state transitions and duplicate-claim protection.
- The bot/backend publishes the final transcript by editing or replying in the
  original chat after a worker completes the job.
- Bot UI language is independent from recognition engine/language. Recognition
  language is worker/job metadata, preferably auto-detected for MVP with an
  optional manual override later.
- Donation copy remains, but donation framing changes to funding transcription
  compute.
- Legacy engine-based Voicy behavior is directed to `@voicy_legacy_bot`.

## Target Data Model

Use Typegoose/Mongoose models to match the existing repo style.

### Chat changes

Keep:

- `id`
- `adminLocked`
- `silent`
- `filesBanned`
- `transcribeAllAudio`
- `timecodesEnabled`
- `paid`
- `banned`
- `freeVoicesUsed`

Add:

- `uiLocale?: string` or `locale?: string` as the source of truth for bot copy.
- Optional `legacyEngine?: string` only if migration tracking is useful during
  rollout. Do not keep it in active command flows.

Deprecate and remove from active behavior:

- `engine`
- `googleSetupMessageId`
- `googleKey`
- `witToken`
- engine-keyed `languages`

### TranscriptionJob model

Add `src/models/TranscriptionJob.ts` with fields equivalent to:

- `status`: `queued`, `claimed`, `processing`, `completed`, `failed`,
  `cancelled`
- `chatId`
- `telegramChatId`
- `sourceMessageId`
- `statusMessageId?`
- `requestMessageId?` for `/transcribe` replies if distinct
- `fileId`
- `fileUniqueId?`
- `filePath?`
- `fileSize?`
- `mimeType?`
- `sourceKind`: `voice`, `video_note`, `audio`, `document`
- `sourceUrl?` or a short-lived download token strategy
- `requestedByUserId?`
- `forwardedFromUserId?`
- `forwardedSenderName?`
- `uiLocale`
- `recognitionLanguageHint?`
- `workerId?`
- `claimedAt?`
- `heartbeatAt?`
- `attempts`
- `lastError?`
- `resultText?`
- `resultParts?` for timecoded chunks
- `duration?`
- `completedAt?`
- timestamps

Indexes:

- `{ status: 1, createdAt: 1 }` for polling.
- `{ workerId: 1, status: 1 }` for worker recovery/heartbeat.
- `{ chatId: 1, sourceMessageId: 1 }` for diagnostics and duplicate handling.
- Optional unique idempotency key if Telegram update retries create duplicate
  jobs in practice.

### WorkerClient model

Add `src/models/WorkerClient.ts` with:

- `name`
- `tokenHash`
- `enabled`
- `lastSeenAt?`
- `createdAt`
- `lastClaimedAt?`
- optional `capabilities`: engine name, platform, language support, GPU info

Store only token hashes. Generate raw tokens once through an admin script or
admin-only command.

## Backend and Bot Implementation Plan

### Phase 1: queue creation in bot

1. Replace `sendTranscription` with `enqueueTranscriptionJob`.
2. Keep current donation wall, size checks, group behavior, silent behavior, and
   document type checks.
3. After `ctx.getFile()` or `ctx.api.getFile()`, persist a `TranscriptionJob`
   with Telegram ids and file metadata.
4. Send or edit a concise queued message unless the chat is silent.
5. Remove the inline call chain from the active path:
   `urlToText` -> `getTextFromAudio` -> `src/engines`.
6. Keep `Voice` creation for completed results, but move it to a completion
   handler called after worker result upload.

### Phase 2: worker API

Extend the Express app or split a dedicated app module from
`src/helpers/startWebhook.ts`:

- `POST /worker/v1/jobs/claim`
  - Authenticates a worker token.
  - Atomically finds one queued job and marks it claimed/processing.
  - Returns job metadata and a download URL or file id/path strategy.
- `POST /worker/v1/jobs/:id/heartbeat`
  - Refreshes `heartbeatAt`.
  - Rejects if the job is no longer owned by the worker.
- `POST /worker/v1/jobs/:id/result`
  - Accepts final transcript text, optional timecoded chunks, language,
    duration, and engine metadata.
  - Marks the job completed and triggers Telegram publish.
- `POST /worker/v1/jobs/:id/failure`
  - Records retryable/non-retryable errors.
  - Requeues or marks failed according to attempt count.

Use atomic Mongo updates such as `findOneAndUpdate` with status and worker
conditions so two clients cannot process the same job.

### Phase 3: result publication

Add a service module such as `src/helpers/transcriptionJobs/publishResult.ts`:

- Formats transcript using existing split behavior from `handleAudio.ts`.
- Honors `timecodesEnabled`.
- Edits the original queued/status message when present.
- Replies with additional chunks when Telegram's message limit requires it.
- Stores the final `Voice` record for continuity.
- On failure, edits the status message or replies with the localized error copy.

### Phase 4: language migration

1. Introduce UI locale helpers that read `chat.uiLocale` instead of
   `chat.languages[chat.engine]`.
2. Change `/language` and `/l` to choose bot UI language from available
   `locales/*.yaml` files.
3. Update `configureI18n` to use `chat.uiLocale`, falling back to Telegram
   language and then English.
4. Update `setLanguageCodeFromTelegram` so it sets only `uiLocale`; remove the
   Russian-user engine switch.
5. Remove `/engine`, engine callback registration, Google credential commands,
   Wit token command, and engine-specific locale strings from active help/start
   copy.
6. Add migration logic or lazy fallback:
   - Existing chats with engine language settings should derive initial
     `uiLocale` from the old `localeCodeForChat` result.
   - Do not preserve recognition engine selection in vNext behavior.
   - If users require the old controls, direct them to `@voicy_legacy_bot`.

### Phase 5: copy changes

Update all active locale keys touched by the new flow:

- `start`: simpler queued transcription positioning, no engine selection.
- `help`: remove `/engine`, `/google`, `/witToken`, and engine-language copy.
- `initiated`: replace "recognition initiated" with queued/processing copy.
- `sunsetting`, `pay`, `already_paid`: frame donations as funding
  transcription compute.
- `language`, `language_without_engine`, `language_success`: UI language only.
- Add `queued`, `processing`, `completed`, `failed`, and legacy-bot guidance
  keys as needed.

For the first implementation pass, update English and Russian fully, then audit
the remaining locales. If not all locales can be responsibly translated in the
same task, file a planned follow-up rather than shipping mixed stale copy.

## Windows Worker Client Plan

The task list already separates the Windows worker into its own implementation
task, but the backend contract should be designed now.

Recommended repo shape:

- `worker/` for a separate Node or Python client.
- `worker/README.md` with Windows setup, token configuration, GPU dependency
  notes, and run commands.
- `.env.sample` additions for backend worker API base URL and worker token.

Recommended worker behavior:

1. Read `VOICY_WORKER_API_URL` and `VOICY_WORKER_TOKEN`.
2. Poll `POST /worker/v1/jobs/claim`.
3. Download audio by server-provided URL or Telegram file metadata.
4. Transcribe locally on the Windows RTX 4070 Ti machine.
5. Send periodic heartbeats for long jobs.
6. Upload final transcript to `/worker/v1/jobs/:id/result`.
7. Upload failures with retry classification to `/worker/v1/jobs/:id/failure`.

Engine choice for the worker can be Whisper/faster-whisper or another local
stack chosen during the worker task. That choice should stay out of bot UI.

## Streaming Transcript Updates

MVP should treat streaming as optional but prepare the API:

- Store `resultParts` and optional `partialText`/`partialParts` on jobs.
- Add `POST /worker/v1/jobs/:id/partial` only if the worker engine can emit
  useful chunks.
- Rate-limit Telegram message edits. A practical first rule is no more than one
  edit every 3-5 seconds per job, plus a final edit on completion.
- If partials are unavailable, show queued/processing/final states only.

## MVP Scope

- Bot creates durable queued jobs for voice, video note, supported audio, and
  supported document inputs.
- Donation wall is preserved with compute-funding copy.
- `/language` controls only bot UI language.
- Engine selection and old provider credential commands are removed from active
  UX.
- Authenticated worker clients can claim jobs and submit final results.
- Duplicate claim protection is implemented atomically in Mongo.
- Completion publishes final transcript to Telegram and stores `Voice`.
- English and Russian copy are updated; remaining locales are audited for stale
  active keys.
- CI validation remains TypeScript compile plus lint, with targeted API tests or
  scripts added for worker auth/claim/result behavior.

## Stretch Goals

- Live partial transcript endpoint and Telegram edit-message UX.
- Worker capability routing by language, model, or GPU profile.
- Worker admin dashboard or status command.
- Job cancellation from Telegram.
- Full locale rewrite across every existing YAML file.
- Backfill migration script for historical chats beyond lazy migration.
- Rich observability: queue depth, processing latency, worker health metrics.

## QA and Validation Plan

Automated/scripted validation:

- `yarn build-ts`
- `yarn lint`
- Add API-level tests or scripts proving:
  - unauthenticated worker requests fail;
  - authenticated claim returns one queued job;
  - two clients cannot claim the same job;
  - result upload changes job state and triggers transcript publication path;
  - failed jobs retry or fail according to configured attempt count.

Manual/OpenClaw QA:

- Environment: Telegram Web in the logged-in browser session on this Mac, using
  a feature branch/PR deployment or local bot token if available.
- Send a voice message to the bot in a private chat and verify a job is queued.
- Send a voice message in a group where `transcribeAllAudio` is enabled and
  verify a job is queued.
- In a group where `transcribeAllAudio` is disabled, verify unsolicited voice
  messages are ignored and `/transcribe` on a replied voice queues a job.
- Complete a job through the worker API and verify Telegram receives the final
  transcript.
- Verify donation wall copy says donations fund transcription compute.
- Verify `/language` changes bot UI language only.
- Verify help/start copy mentions `@voicy_legacy_bot` for the old engine-based
  experience.

## Feature Branch and PR Workflow

Required workflow for implementation tasks:

1. Start from current `origin/main`.
2. Create a feature branch, for example
   `symphony/KANEO-2-queued-transcription`.
3. Make scoped commits on the branch. Do not push to `main`.
4. Run required validation before push:
   `yarn build-ts` and `yarn lint`, plus any task-specific tests/scripts.
5. Push the branch to `origin`.
6. Open or update a GitHub PR targeting `main`.
7. Add the `symphony` label to the PR.
8. Link the PR on the Kaneo task workpad.
9. Move the Kaneo task to `in-review` only after validation is green and the PR
   is linked.

For this planning task, the feature branch is
`symphony/KANEO-1-voicy-vnext-plan` and the validation target is this planning
document rather than the application build.

## Follow-Up Task Assessment

The Kaneo board already contains planned follow-ups that map to the discovered
implementation work:

- `KANEO-2`: bot UX simplification and queued job creation.
- `KANEO-3`: authenticated transcription client API.
- `KANEO-4`: Windows worker client.
- `KANEO-5`: live transcript streaming/edit-message UX.
- `KANEO-6`: donation and legacy-bot messaging.
- `KANEO-7`: end-to-end QA.
- `KANEO-8`: cleanup of dead legacy paths.
- `KANEO-9`: locale audit and stale translation cleanup.

No additional backlog task is needed from this audit.
