#!/usr/bin/env node

require('module-alias/register')

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const { redactSensitiveText } = require('../dist/helpers/report')
const {
  transcriptText,
} = require('../dist/helpers/transcriptionJobs/transcriptFormatting')
const localizedTranscriptionText = require('../dist/helpers/localizedTranscriptionText')
  .default

assert.equal(
  transcriptText({ resultText: '' }),
  '',
  'empty completed transcript should remain empty for fallback publishing'
)
assert.equal(
  transcriptText({ resultParts: [] }),
  '',
  'empty completed transcript parts should remain empty for fallback publishing'
)
assert.equal(
  transcriptText({
    resultText: JSON.stringify({
      text: '',
      parts: [],
      language: 'nn',
      duration: 1,
      metadata: { model: 'large-v3' },
    }),
  }),
  '',
  'structured empty worker JSON should remain empty for fallback publishing'
)
assert.equal(
  transcriptText({
    resultText: JSON.stringify({
      text: 'structured transcript',
      parts: [],
      language: 'en',
    }),
  }),
  'structured transcript',
  'structured worker JSON should publish its text field'
)
assert.equal(
  transcriptText({
    resultText: JSON.stringify({
      text: 'ignored fallback',
      parts: [{ timeCode: '00:01', text: 'part transcript' }],
    }),
  }),
  '00:01:\npart transcript',
  'structured worker JSON should prefer timecoded parts when present'
)
assert.equal(
  localizedTranscriptionText('en', 'completed_empty'),
  'Done, but no text was detected.',
  'English empty-result copy should clearly describe no detected text'
)
assert.equal(
  localizedTranscriptionText('ru', 'completed_empty'),
  'Готово, но текст не найден.',
  'Russian empty-result copy should clearly describe no detected text'
)

const sensitive = [
  '123456789:abcdefghijklmnopqrstuvwxyzABCDE',
  ['sk', 'live', 'abcdefghijklmnopqrstuvwxyz'].join('_'),
  ['whsec', 'abcdefghijklmnopqrstuvwxyz'].join('_'),
  'Bearer worker-secret-token',
  'https://example.test/file?token=secret',
  '/Users/nikita/voicy-worker/input.ogg',
  'C:\\voicy-worker\\input.ogg',
].join(' ')
const redacted = redactSensitiveText(sensitive)

assert(!redacted.includes('123456789:'), 'Telegram token should be redacted')
assert(!redacted.includes('sk_live_'), 'Stripe key should be redacted')
assert(!redacted.includes('whsec_'), 'Stripe webhook secret should be redacted')
assert(!redacted.includes('worker-secret-token'), 'bearer token should be redacted')
assert(!redacted.includes('token=secret'), 'query token should be redacted')
assert(!redacted.includes('/Users/nikita'), 'POSIX local path should be redacted')
assert(!redacted.includes('C:\\voicy-worker'), 'Windows local path should be redacted')

const publishSource = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src',
    'helpers',
    'transcriptionJobs',
    'publishCompletedTranscriptionJob.ts'
  ),
  'utf8'
)

assert(
  publishSource.includes('firstText || fallbackText'),
  'completed publisher should use empty-result fallback text'
)
assert(
  publishSource.includes('text: transcriptText(job)') &&
    publishSource.includes('findOneAndUpdate') &&
    publishSource.includes('upsert: true'),
  'completed voice records should store normalized transcript text'
)
assert(
  !publishSource.includes('editMessageCaption'),
  'completed publisher should not mutate original media captions'
)

console.log('error and empty handling proof passed')
