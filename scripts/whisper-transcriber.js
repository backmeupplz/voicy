#!/usr/bin/env node

const fs = require('fs/promises')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')

const inputPath = process.argv[2]
const outputPath = process.argv[3]
const language = process.argv[4]

if (!inputPath || !outputPath) {
  throw new Error(
    'Usage: node scripts/whisper-transcriber.js <input> <output> [language]'
  )
}

const model = process.env.VOICY_WHISPER_MODEL || 'turbo'
const device = process.env.VOICY_WHISPER_DEVICE

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const stdout = []
    const stderr = []

    child.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)))
    child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)))
    child.on('error', reject)
    child.on('close', (code) => {
      const output = Buffer.concat(stdout).toString('utf8')
      const errorOutput = Buffer.concat(stderr).toString('utf8')
      if (code !== 0) {
        reject(
          new Error(
            `whisper exited with ${code}: ${errorOutput || output}`.trim()
          )
        )
        return
      }
      resolve({ output, errorOutput })
    })
  })
}

function formatTimeCode(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0)
  const minutes = Math.floor(safeSeconds / 60)
  const wholeSeconds = Math.floor(safeSeconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(
    2,
    '0'
  )}`
}

async function findWhisperJson(outputDir, inputPath) {
  const preferred = path.join(
    outputDir,
    `${path.basename(inputPath, path.extname(inputPath))}.json`
  )
  try {
    return await fs.readFile(preferred, 'utf8')
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
  }

  const entries = await fs.readdir(outputDir)
  const jsonFile = entries.find((entry) => entry.endsWith('.json'))
  if (!jsonFile) {
    throw new Error('whisper did not produce a JSON transcript')
  }
  return fs.readFile(path.join(outputDir, jsonFile), 'utf8')
}

async function main() {
  const outputDir = await fs.mkdtemp(
    path.join(os.tmpdir(), `voicy-whisper-${process.pid}-`)
  )

  try {
    const args = [
      inputPath,
      '--model',
      model,
      '--output_format',
      'json',
      '--output_dir',
      outputDir,
      '--verbose',
      'False',
    ]

    if (device) {
      args.push('--device', device)
    }
    if (language) {
      args.push('--language', language)
    }

    await run('whisper', args)
    const rawTranscript = await findWhisperJson(outputDir, inputPath)
    const transcript = JSON.parse(rawTranscript)
    const text = String(transcript.text || '').trim()

    if (!text) {
      throw new Error('whisper produced an empty transcript')
    }

    const segments = Array.isArray(transcript.segments)
      ? transcript.segments
      : []
    const parts = segments
      .map((segment) => ({
        timeCode: formatTimeCode(segment.start),
        text: String(segment.text || '').trim(),
      }))
      .filter((part) => part.text)

    const lastSegment = segments[segments.length - 1]
    const result = {
      text,
      parts: parts.length ? parts : [{ timeCode: '00:00', text }],
      language: transcript.language || language || undefined,
      duration: lastSegment?.end,
      metadata: {
        engine: 'openai-whisper-cli',
        model,
        device: device || 'default',
      },
    }

    await fs.writeFile(outputPath, JSON.stringify(result), 'utf8')
  } finally {
    await fs.rm(outputDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
