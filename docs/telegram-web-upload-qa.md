# Telegram Web Upload QA

Use this helper when Voicy QA needs proof that Telegram Web can send an audio
or document fixture through the same path a user exercises. It uses Chrome
DevTools Protocol against the dedicated Telegram Web QA profile and does not
use Peekaboo, AppleScript, or Chrome Apple Events.

## Chrome Setup

Launch Chrome with remote debugging and the dedicated QA profile:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/Library/Application Support/Symphony/telegram-web-qa-chrome" \
  "https://web.telegram.org/k/#@okamikron_bot"
```

The profile must already be logged in to Telegram Web. Keep this profile
dedicated to QA because remote debugging exposes the browser session to local
automation.

## Private Bot Audio Upload

From the repo root, upload the default public WAV speech sample:

```sh
yarn qa:telegram-upload \
  --browser-url http://127.0.0.1:9222 \
  --chat @okamikron_bot \
  --sample \
  --caption "VOI-KANEO-18 audio upload $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --send \
  --timeout-ms 120000 \
  --evidence-file tmp/telegram-upload-private.json \
  --screenshot-file tmp/telegram-upload-private.png \
  --json
```

To use a local fixture instead:

```sh
yarn qa:telegram-upload \
  --browser-url http://127.0.0.1:9222 \
  --chat @okamikron_bot \
  --file ./fixtures/voice.wav \
  --caption "VOI-KANEO-18 local fixture $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --send \
  --evidence-file tmp/telegram-upload-private.json \
  --json
```

The helper opens or reuses Telegram Web, navigates to the target chat, attaches
the fixture through Telegram's file input, clicks the upload send button, and
writes JSON evidence with the fixture path, chat, active URL, visible message
snippets, and expectation results.

## Status And Transcript Checks

When the test bot runtime and worker are available, pass expected visible text
for the status/progress/final transcript you need to prove:

```sh
yarn qa:telegram-upload \
  --browser-url http://127.0.0.1:9222 \
  --chat @okamikron_bot \
  --sample \
  --caption "VOI-KANEO-18 text proof $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --expected-text "Turning into text" \
  --expected-text "zero" \
  --send \
  --timeout-ms 180000 \
  --evidence-file tmp/telegram-upload-transcript.json \
  --screenshot-file tmp/telegram-upload-transcript.png \
  --json
```

Use the exact strings the bot should render in the active locale. Include
Markdown-sensitive strings when the QA goal is to prove formatting in the
visible Telegram Web output.

## Group Chat

Use a Telegram Web URL or group handle in `--chat` after the bot is present in
the group:

```sh
yarn qa:telegram-upload \
  --browser-url http://127.0.0.1:9222 \
  --chat "https://web.telegram.org/k/#-123456789" \
  --sample \
  --caption "VOI-KANEO-18 group upload $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --expected-text "Turning into text" \
  --send \
  --timeout-ms 180000 \
  --evidence-file tmp/telegram-upload-group.json \
  --screenshot-file tmp/telegram-upload-group.png \
  --json
```

Before group upload QA, enable the bot's group voice-to-text path with the
normal product command flow, such as `/transcribe_all` if that is the current
canonical command. The helper only sends the fixture and captures visible
evidence; it does not mutate bot settings or Mongo state.

## Evidence To Record

Attach or link the generated JSON and screenshot in the Kaneo/PR review notes.
Record:

- Chrome CDP URL, normally `http://127.0.0.1:9222`.
- Target bot or group.
- Exact caption and expected text arguments.
- Fixture source, path, and byte size from the helper output.
- Whether `sent` and `verified` are true.
- Any visible status/progress/final transcript snippets from the helper output.

## Failure Handling

- If Chrome is unreachable, relaunch it with the exact remote debugging flags
  above.
- If Telegram Web shows a login screen, the QA profile is not logged in; record
  that as the blocker.
- If upload fails before send, keep the JSON error and active Telegram URL in
  the workpad. The most likely cause is a Telegram Web DOM change around the
  attach/file input controls.
- If upload succeeds but bot replies do not appear, check the test bot runtime
  and worker separately before changing this helper.
