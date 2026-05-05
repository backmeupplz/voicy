#!/usr/bin/env node

require('module-alias/register')

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const {
  TRANSCRIPTION_PROGRESS_EMOJIS,
  pickTranscriptionProgressEmoji,
  transcriptionProgressPreviewHtml,
  transcriptionProgressStatusHtml,
} = require('../dist/helpers/transcriptionJobs/progressStatusText')

assert.equal(
  pickTranscriptionProgressEmoji(() => 0),
  TRANSCRIPTION_PROGRESS_EMOJIS[0],
  'lowest deterministic random value should choose first status emoji'
)
assert.equal(
  pickTranscriptionProgressEmoji(() => 0.999),
  TRANSCRIPTION_PROGRESS_EMOJIS[TRANSCRIPTION_PROGRESS_EMOJIS.length - 1],
  'high deterministic random value should choose last status emoji'
)
assert.equal(
  pickTranscriptionProgressEmoji(() => Number.NaN),
  TRANSCRIPTION_PROGRESS_EMOJIS[0],
  'invalid random value should fall back to first status emoji'
)

assert.equal(
  transcriptionProgressStatusHtml('en', 'progress_processing', () => 0),
  '<i>🪄 Turning into text...</i>',
  'English processing status should italicize the full emoji-prefixed line'
)
assert.equal(
  transcriptionProgressStatusHtml('ru', 'progress_processing', () => 0.25),
  '<i>✨ Превращаем в текст...</i>',
  'Russian processing status should italicize the full emoji-prefixed line'
)

const preview = transcriptionProgressPreviewHtml(
  'en',
  'draft <text> & user_value',
  () => 0.5
)
assert(
  preview.startsWith('<i>🎧 Turning into text...</i>\n\n'),
  'partial preview should keep the whole status line italic, including emoji'
)
assert(
  preview.includes('draft &lt;text&gt; &amp; user_value'),
  'partial preview should HTML-escape worker text before using parse mode'
)
assert(
  preview.endsWith('\n\nDraft text; final text may still change.'),
  'partial preview should keep the localized footer outside the italic line'
)

const publishProgressSource = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src',
    'helpers',
    'transcriptionJobs',
    'publishTranscriptionJobProgress.ts'
  ),
  'utf8'
)
const handleAudioSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'handlers', 'handleAudio.ts'),
  'utf8'
)

assert(
  publishProgressSource.includes('editMessageText') &&
    publishProgressSource.includes("parse_mode: 'HTML'"),
  'progress publisher should edit only the status message text with HTML parse mode'
)
assert(
  !publishProgressSource.includes('editMessageCaption') &&
    !handleAudioSource.includes('editMessageCaption'),
  'queued/progress status paths should not edit original media captions'
)

console.log('progress status format proof passed')
