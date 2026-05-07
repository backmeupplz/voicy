#!/usr/bin/env node

const fs = require('fs')

const inputPath = process.argv[2]
const outputPath = process.argv[3]
const model = process.argv[4] || process.env.VOICY_WORKER_MODEL || 'proof-model'

if (!inputPath || !outputPath) {
  throw new Error(
    'Usage: node scripts/fake-transcriber.js <input> <output> [model]'
  )
}

const input = fs.readFileSync(inputPath)
if (input.length === 0) {
  throw new Error('input file is empty')
}

const transcriptText =
  process.env.VOICY_FAKE_TRANSCRIPT_TEXT ||
  'fake transcript from worker client proof'

fs.writeFileSync(
  outputPath,
  JSON.stringify({
    text: transcriptText,
    parts: [{ timeCode: '00:00', text: transcriptText }],
    language: 'en',
    duration: 1.5,
    metadata: { model, inputPath, outputPath, argv: process.argv.slice(2) },
  })
)
