#!/usr/bin/env node

const fs = require('fs/promises')
const http = require('http')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')

const {
  loadConfig,
  processNextJob,
} = require('../dist/workerClient/runWindowsWorker')

const SAMPLE_TEXT = 'Hello world, this is a local transcription test.'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

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
            `${command} exited with ${code}: ${errorOutput || output}`.trim()
          )
        )
        return
      }
      resolve({ output, errorOutput })
    })
  })
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    request.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch (error) {
        reject(error)
      }
    })
    request.on('error', reject)
  })
}

async function createSampleAudio(workDir) {
  const aiffPath = path.join(workDir, 'sample.aiff')
  const wavPath = path.join(workDir, 'sample.wav')
  await run('say', ['-v', 'Samantha', '-o', aiffPath, SAMPLE_TEXT])
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', aiffPath, wavPath])
  return fs.readFile(wavPath)
}

function createProofServer(sampleAudio) {
  const state = {
    claimed: false,
    result: undefined,
    failure: undefined,
  }

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1')
    const token = request.headers.authorization
    if (token !== 'Bearer local-whisper-proof-token') {
      response.writeHead(401, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ error: 'invalid_worker_token' }))
      return
    }

    if (request.method === 'POST' && url.pathname === '/worker/v1/jobs/claim') {
      if (state.claimed) {
        response.writeHead(204)
        response.end()
        return
      }
      state.claimed = true
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({
          job: {
            id: 'local-whisper-proof-job',
            status: 'processing',
            sourceKind: 'voice',
            mimeType: 'audio/wav',
            recognitionLanguageHint: 'en',
            attempts: 1,
          },
        })
      )
      return
    }

    if (
      request.method === 'GET' &&
      url.pathname === '/worker/v1/jobs/local-whisper-proof-job/source'
    ) {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({
          source: {
            sourceUrl: `http://127.0.0.1:${server.address().port}/audio.wav`,
            sourceKind: 'voice',
            mimeType: 'audio/wav',
            fileId: 'local-whisper-proof-file',
          },
        })
      )
      return
    }

    if (request.method === 'GET' && url.pathname === '/audio.wav') {
      response.writeHead(200, {
        'Content-Type': 'audio/wav',
        'Content-Length': sampleAudio.length,
      })
      response.end(sampleAudio)
      return
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/worker/v1/jobs/local-whisper-proof-job/heartbeat'
    ) {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ job: { id: 'local-whisper-proof-job' } }))
      return
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/worker/v1/jobs/local-whisper-proof-job/result'
    ) {
      state.result = await readJson(request)
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({
          job: { id: 'local-whisper-proof-job', status: 'completed' },
        })
      )
      return
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/worker/v1/jobs/local-whisper-proof-job/failure'
    ) {
      state.failure = await readJson(request)
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({
          job: { id: 'local-whisper-proof-job', status: 'queued' },
        })
      )
      return
    }

    response.writeHead(404, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ error: 'not_found' }))
  })

  return { server, state }
}

async function main() {
  const workDir = await fs.mkdtemp(
    path.join(os.tmpdir(), `voicy-local-whisper-proof-${process.pid}-`)
  )
  const workerDir = path.join(workDir, 'worker')
  const sampleAudio = await createSampleAudio(workDir)
  const { server, state } = createProofServer(sampleAudio)
  await listen(server)

  try {
    const config = loadConfig({
      VOICY_WORKER_API_URL: `http://127.0.0.1:${
        server.address().port
      }/worker/v1`,
      VOICY_WORKER_TOKEN: 'local-whisper-proof-token',
      VOICY_WORKER_TRANSCRIBE_COMMAND:
        'node scripts/whisper-transcriber.js {input} {output} {language}',
      VOICY_WORKER_WORK_DIR: workerDir,
      VOICY_WORKER_ENGINE: 'openai-whisper-cli',
      VOICY_WORKER_MODEL: process.env.VOICY_WHISPER_MODEL || 'tiny',
    })

    const processed = await processNextJob(config, {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    })

    assert(processed, 'worker should process the local Whisper job')
    assert(!state.failure, 'local Whisper worker should not report failure')
    assert(state.result, 'worker should upload a local Whisper result')

    const text = String(state.result.text || '').toLowerCase()
    assert(text.includes('hello'), 'transcript should include "hello"')
    assert(
      text.includes('transcription'),
      'transcript should include "transcription"'
    )
    assert(
      state.result.engine === 'openai-whisper-cli',
      'worker should report the local Whisper engine'
    )

    console.log('local Whisper worker proof passed')
    console.log(`transcript: ${state.result.text}`)
  } finally {
    await close(server)
    await fs.rm(workDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
