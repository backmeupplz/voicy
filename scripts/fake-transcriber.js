#!/usr/bin/env node

const fs = require('fs')

const inputPath = process.argv[2]
const outputPath = process.argv[3]

if (!inputPath || !outputPath) {
  throw new Error('Usage: node scripts/fake-transcriber.js <input> <output>')
}

const input = fs.readFileSync(inputPath)
if (input.length === 0) {
  throw new Error('input file is empty')
}

fs.writeFileSync(
  outputPath,
  JSON.stringify({
    text: 'fake transcript from worker client proof',
    parts: [
      { timeCode: '00:00', text: 'fake transcript from worker client proof' },
    ],
    language: 'en',
    duration: 1.5,
    metadata: { model: 'proof-model' },
  })
)
