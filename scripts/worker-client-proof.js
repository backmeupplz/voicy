#!/usr/bin/env node

const http = require('http')
const os = require('os')
const path = require('path')

const {
  loadConfig,
  processNextJob,
} = require('../dist/workerClient/runWindowsWorker')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => {
      if (chunks.length === 0) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch (error) {
        reject(error)
      }
    })
    request.on('error', reject)
  })
}

function createProofServer() {
  const state = {
    claimed: false,
    result: undefined,
    failure: undefined,
    heartbeats: 0,
    audioAuthorization: undefined,
  }

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1')
    if (request.method === 'GET' && url.pathname === '/audio/proof.ogg') {
      state.audioAuthorization = request.headers.authorization
      response.writeHead(200, { 'Content-Type': 'audio/ogg' })
      response.end(Buffer.from('proof audio bytes'))
      return
    }

    const token = request.headers.authorization
    if (token !== 'Bearer proof-worker-token') {
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
            id: 'proof-job',
            status: 'processing',
            sourceKind: 'voice',
            recognitionLanguageHint: 'en',
            attempts: 1,
          },
        })
      )
      return
    }

    if (
      request.method === 'GET' &&
      url.pathname === '/worker/v1/jobs/proof-job/source'
    ) {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({
          source: {
            sourceUrl: `http://127.0.0.1:${
              server.address().port
            }/audio/proof.ogg`,
            sourceKind: 'voice',
            mimeType: 'audio/ogg',
            fileId: 'proof-file',
          },
        })
      )
      return
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/worker/v1/jobs/proof-job/heartbeat'
    ) {
      state.heartbeats += 1
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ job: { id: 'proof-job' } }))
      return
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/worker/v1/jobs/proof-job/result'
    ) {
      state.result = await readJson(request)
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({ job: { id: 'proof-job', status: 'completed' } })
      )
      return
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/worker/v1/jobs/proof-job/failure'
    ) {
      state.failure = await readJson(request)
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({ job: { id: 'proof-job', status: 'queued' } })
      )
      return
    }

    response.writeHead(404, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ error: 'not_found' }))
  })

  return { server, state }
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, () => resolve())
  })
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

async function main() {
  const { server, state } = createProofServer()
  await listen(server)

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}/worker/v1`
    const env = {
      VOICY_WORKER_API_URL: baseUrl,
      VOICY_WORKER_TOKEN: 'proof-worker-token',
      VOICY_WORKER_TRANSCRIBE_COMMAND:
        'node scripts/fake-transcriber.js {input} {output}',
      VOICY_WORKER_WORK_DIR: path.join(
        os.tmpdir(),
        `voicy-worker-proof-${process.pid}`
      ),
      VOICY_WORKER_IDLE_EXIT: '1',
      VOICY_WORKER_ENGINE: 'proof-engine',
      VOICY_WORKER_MODEL: 'proof-model',
    }
    const config = loadConfig(env)
    const processed = await processNextJob(config, {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    })

    assert(processed, 'worker should process the claimed job')
    assert(!state.failure, 'worker should not report failure')
    assert(state.result, 'worker should submit a result')
    assert(
      state.result.text === 'fake transcript from worker client proof',
      'worker should submit transcript text'
    )
    assert(
      state.result.engine === 'proof-engine',
      'worker should submit engine'
    )
    assert(state.result.language === 'en', 'worker should submit language')
    assert(
      state.result.metadata.model === 'proof-model',
      'worker should submit model metadata'
    )
    assert(
      !state.audioAuthorization,
      'worker should not send its API token to source downloads'
    )

    const idleProcessed = await processNextJob(config, {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    })
    assert(!idleProcessed, 'worker should return false when no job is queued')
  } finally {
    await close(server)
  }

  const failureProof = createProofServer()
  await listen(failureProof.server)

  try {
    const baseUrl = `http://127.0.0.1:${
      failureProof.server.address().port
    }/worker/v1`
    const config = loadConfig({
      VOICY_WORKER_API_URL: baseUrl,
      VOICY_WORKER_TOKEN: 'proof-worker-token',
      VOICY_WORKER_TRANSCRIBE_COMMAND:
        'node -e "process.stderr.write(\\"boom\\"); process.exit(3)"',
      VOICY_WORKER_WORK_DIR: path.join(
        os.tmpdir(),
        `voicy-worker-failure-proof-${process.pid}`
      ),
    })

    const processed = await processNextJob(config, {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    })

    assert(processed, 'worker should process the failure job')
    assert(
      !failureProof.state.result,
      'failed command should not submit result'
    )
    assert(failureProof.state.failure, 'failed command should report failure')
    assert(
      failureProof.state.failure.retryable === true,
      'command failure should be retryable'
    )
  } finally {
    await close(failureProof.server)
  }

  console.log('worker client proof passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
