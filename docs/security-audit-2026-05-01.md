# Voicy Security Audit - 2026-05-01

Scope: Telegram bot input handling, payment activation, worker API/authentication,
file/audio handling, external command execution, Mongo persistence, secrets,
logging, dependency posture, deployment defaults, and abuse controls.

Audited commit: `a2f0410`

## Summary

The highest-risk area is the new worker transcription path because it crosses
trust boundaries: Telegram input becomes queued Mongo data, authenticated
workers fetch remote audio, run local commands, and submit transcript results
back to the bot. One concrete issue was fixed in this audit: worker source
downloads no longer reuse the worker API Axios client, so the worker bearer
token is not sent to Telegram or any other source URL. The worker now also
rejects non-Telegram source URLs, except loopback URLs when the worker API
itself is loopback for local tests.

Remaining non-trivial findings are tracked as Kaneo follow-up tasks rather
than expanded into this audit.

Created follow-up tasks:
- VOI-KANEO-25: Remove Telegram bot token from persisted Voicy source URLs.
- VOI-KANEO-26: Upgrade Voicy dependencies to clear security advisories.
- VOI-KANEO-27: Add Voicy transcription abuse limits per chat and user.
- VOI-KANEO-28: Replace shell-template worker transcription command execution.
- VOI-KANEO-29: Sanitize Voicy runtime error logging.
- VOI-KANEO-30: Harden Voicy Stripe activation and file intake validation.

## Validation Performed

- `yarn audit --groups dependencies --level moderate`
  - Result: failed with 4 advisories: 1 high, 2 moderate, 1 low.
- `yarn why node-fetch && yarn why qs && yarn why js-yaml`
  - Result: confirmed vulnerable paths through `grammy`, `stripe`, and
    `@grammyjs/i18n`.
- Secret-pattern scan with `rg`
  - Result: no committed real-looking Telegram, Stripe, Mongo credential, or
    worker token found. Only `.env.sample` placeholders and localhost examples
    matched.
- Targeted source review with `rg` and file inspection for:
  - `parse_mode`, Markdown escaping, Telegram sends/edits.
  - worker authentication, bearer tokens, hash storage, job ownership.
  - file download, temp path handling, command execution.
  - Mongo queries/updates and worker claim ownership.
  - Stripe checkout/webhook payment activation.
  - logging, secrets, deployment defaults, rate/abuse limits.
- `yarn install --frozen-lockfile`
- `yarn build-ts`
- `yarn lint`
- `yarn test:worker-client`
- `git diff --check`

## Findings

### HIGH-01: Worker source downloads leaked worker credentials to source URLs

Status: fixed in this audit.

Before the fix, `src/workerClient/runWindowsWorker.ts` used the authenticated
worker API Axios instance for `source.sourceUrl` downloads. Because that
instance carries `Authorization: Bearer <VOICY_WORKER_TOKEN>`, the worker token
could be sent to Telegram file URLs or to any URL returned by the backend.

Impact:
- Worker bearer token disclosure to a third-party host.
- SSRF-style abuse if a compromised backend/Mongo record returned an arbitrary
  source URL.

Fix:
- Source downloads now use a clean `axios.get`.
- Source URLs are restricted to `https://api.telegram.org`.
- Loopback source URLs are allowed only when the worker API URL is also
  loopback, preserving local proof tests without enabling production localhost
  SSRF.
- `scripts/worker-client-proof.js` now asserts the fake audio endpoint receives
  no Authorization header.

Evidence:
- Fixed in `src/workerClient/runWindowsWorker.ts`.
- Covered by `yarn test:worker-client`.

### HIGH-02: Telegram bot token is persisted inside transcription source URLs

Status: follow-up required.

`src/helpers/fileUrl.ts` builds Telegram file URLs containing
`process.env.TOKEN`. `src/handlers/handleAudio.ts` stores that URL in
`TranscriptionJob.sourceUrl`, and
`src/helpers/transcriptionJobs/publishCompletedTranscriptionJob.ts` copies it to
historical `Voice.url` records.

Impact:
- Mongo backups, debug dumps, logs, or read-only DB access can expose the
  Telegram bot token.
- The token is broader than a single file URL and can be used against the Bot
  API until rotated.

Recommendation:
- Persist only Telegram `file_id`, `file_unique_id`, and `file_path`.
- Generate download URLs just-in-time inside an authenticated backend path, or
  proxy source downloads through a short-lived backend URL that never exposes
  the bot token to Mongo or workers.
- Migrate/clear historical `sourceUrl` and `Voice.url` values that contain bot
  tokens, then rotate the Telegram bot token.

### HIGH-03: Dependency audit still reports known vulnerable packages

Status: follow-up required.

`yarn audit --groups dependencies --level moderate` reported:
- High: `node-fetch@2.6.5` via `grammy`, patched in `>=2.6.7`.
- Moderate: `js-yaml@4.1.0` via `@grammyjs/i18n`, patched in `>=4.1.1`.
- Moderate: `qs@6.11.0` via `stripe`, patched in `>=6.14.1`.
- Low: one additional advisory in the audited dependency tree.

Impact:
- The `node-fetch` advisory is relevant to credential forwarding on redirects.
- The `qs` advisory is a request parsing DoS class.
- The `js-yaml` advisory is lower practical risk here because locale YAML is
  repo-controlled, but it should still be removed from the dependency tree.

Recommendation:
- Upgrade `grammy`, `@grammyjs/i18n`, and `stripe` to versions that resolve the
  transitive advisories.
- Re-run build, lint, worker proofs, Telegram runtime checks, and payment flow
  smoke tests after upgrade.

### HIGH-04: Paid chats can enqueue unbounded transcription work

Status: follow-up required.

The bot enforces a 19 MB Telegram file limit and a paid-chat gate, but there is
no per-chat/user/job rate limit, no queue depth cap, and `Chat.transcribeAllAudio`
defaults to `true`. In a paid group, any member can generate repeated jobs until
the external worker/runtime is saturated.

Impact:
- Compute cost abuse.
- Worker starvation and queue growth.
- Group spam can trigger many source downloads and transcription commands.

Recommendation:
- Add per-chat and per-user rate limits for new transcription jobs.
- Add a maximum queued/processing job count per chat.
- Consider making group `transcribeAllAudio` opt-in or adding admin-controlled
  defaults for large groups.
- Return clear user-facing throttling messages.

### MEDIUM-01: Worker command execution still uses a shell template

Status: remediated in VOI-KANEO-28.

The vulnerable implementation built a command string from
`VOICY_WORKER_TRANSCRIBE_COMMAND` and ran it with `spawn(command, { shell:
true })`. Inputs were quoted with `JSON.stringify`, which is not a complete
shell-escaping strategy on POSIX shells and is brittle across Windows shells.

Impact:
- If a path component or future source filename contains shell metacharacters,
  command injection becomes possible.
- Operator-provided command templates are harder to validate and test safely.

Remediation:
- The worker now requires `VOICY_WORKER_TRANSCRIBE_EXECUTABLE` plus
  `VOICY_WORKER_TRANSCRIBE_ARGS_JSON` and calls `spawn(executable, args, {
  shell: false })`.
- Worker proof coverage includes paths containing quotes, spaces, `$`,
  backticks, and parentheses.

### MEDIUM-02: Error reporting logs the full Grammy context

Status: follow-up required.

`src/helpers/report.ts` logs `console.log(error, info)`, and callers often pass
`{ ctx }`. Grammy context objects can include message text, user/chat metadata,
API/client internals, and potentially sensitive runtime data depending on
library internals.

Impact:
- Production logs can collect more personal data than necessary.
- Logs may expose operational secrets or payment/chat state during exception
  paths.

Recommendation:
- Replace raw context logging with a redacted structured logger.
- Keep only location, update id, chat id, user id, message type, command name,
  job id, and sanitized error message/stack.
- Avoid logging tokens, full message payloads, Stripe sessions, or transcript
  content unless explicitly needed for a debug build.

### MEDIUM-03: Stripe activation should verify payment details explicitly

Status: follow-up required.

The Stripe webhook verifies the webhook signature and listens for
`checkout.session.completed`, then marks `client_reference_id` as paid. It does
not explicitly check expected payment status, amount, currency, price id, or
mode before setting `Chat.paid = true`.

Impact:
- Payment activation depends on the assumption that every completed checkout
  session received by this Stripe account came from the current donation flow.
- Future products, prices, or manual sessions in the same account could widen
  the activation path.

Recommendation:
- Require `STRIPE_WEBHOOK_SIGNING_SECRET` at startup.
- Verify `payment_status`, `mode`, currency, amount, and expected price id or
  metadata before activating a chat.
- Store the Stripe session id/payment intent id on the chat or a payment record
  for auditability and replay handling.

### MEDIUM-04: File/document intake accepts broad `octet-stream` inputs

Status: follow-up required.

`src/middlewares/checkDocumentType.ts` accepts MIME types containing `audio` or
`octet-stream` and assumes `mime_type` exists. This allows arbitrary binary
documents under the Telegram size limit into the transcription queue if files
are enabled.

Impact:
- Avoidable worker compute waste on unsupported binary files.
- Missing MIME values can throw in middleware and rely on global error handling.

Recommendation:
- Handle missing `mime_type` safely.
- Validate extensions and Telegram media type in addition to MIME.
- Reject unsupported `octet-stream` files unless the filename extension is an
  explicitly supported audio extension.

### LOW-01: Worker API and bot runtime need deployment hardening documentation

Status: follow-up recommended.

The worker API relies on bearer tokens and should only be exposed over TLS
behind a trusted reverse proxy. The code does not enforce HTTPS directly, which
is acceptable for a Node app behind infrastructure, but the production
requirement should be documented and checked.

Recommendation:
- Document required TLS/reverse proxy assumptions.
- Add a runtime health/security check for required secrets and production
  environment settings.
- Add worker auth failure rate limiting at the edge or app layer.

## Positive Observations

- Worker tokens are high-entropy generated values, and Mongo stores only
  SHA-256 hashes.
- Worker job mutation endpoints check both job id and `workerId`, preventing one
  worker from completing another worker's claimed job.
- Worker result and progress bodies have request and text size limits.
- Transcript text is sent without Telegram Markdown/HTML parse mode, so worker
  output is not interpreted as markup.
- Markdown-sensitive localized bot handles and commands are escaped through
  `markdownI18n` on active Markdown replies.
- No committed real-looking secrets were found by the targeted pattern scan.

## Residual Risk

The audit fixed one credential-leak path in the worker client, but broader
deployment should wait for the high-priority follow-ups: remove bot-token URLs
from persisted data, clear dependency advisories, and add transcription abuse
limits. The payment and logging findings are medium severity but should be
completed before operating this bot against broader untrusted traffic.
