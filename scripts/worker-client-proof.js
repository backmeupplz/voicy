#!/usr/bin/env node

const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')

const {
  loadConfig,
  processAvailableJobs,
  processNextJob,
  runWorker,
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

function createProofServer(options = {}) {
  const state = {
    claimed: false,
    downloaded: false,
    transcribing: false,
    result: undefined,
    failure: undefined,
    heartbeats: 0,
    audioAuthorization: undefined,
    fileDownloadRequests: 0,
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
    const publicMediaPath =
      url.pathname.startsWith('/botproof-telegram-token/') ||
      url.pathname.startsWith('/file/botproof-telegram-token/')
    if (!publicMediaPath && token !== 'Bearer proof-worker-token') {
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
            chatId: 'proof-chat',
            telegramChatId: '12345',
            telegramChatType: 'private',
            sourceMessageId: 101,
            sourceKind: 'voice',
            sourceUrl:
              'https://api.telegram.org/file/botproof-telegram-token/audio/proof.ogg',
            fileSize: 17,
            recognitionLanguageHint: 'en',
            attempts: 1,
          },
        })
      )
      return
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/worker/v1/jobs/claim-download'
    ) {
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
            status: 'downloading',
            chatId: 'proof-chat',
            telegramChatId: '12345',
            telegramChatType: 'private',
            sourceMessageId: 101,
            sourceKind: 'voice',
            sourceUrl:
              'https://api.telegram.org/file/botproof-telegram-token/audio/proof.ogg',
            fileSize: 17,
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
            sourceKind: 'voice',
            mimeType: 'audio/ogg',
            fileId: 'proof-file',
          },
        })
      )
      return
    }

    if (
      request.method === 'GET' &&
      url.pathname === '/botproof-telegram-token/getFile'
    ) {
      assert(
        url.searchParams.get('file_id') === 'proof-file',
        'worker should resolve the Telegram file id locally'
      )
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({
          ok: true,
          result: {
            file_path: options.telegramFilePath || 'audio/proof.ogg',
          },
        })
      )
      return
    }

    if (
      request.method === 'GET' &&
      url.pathname === '/file/botproof-telegram-token/audio/proof.ogg'
    ) {
      state.fileDownloadRequests += 1
      response.writeHead(200, { 'Content-Type': 'audio/ogg' })
      response.end(Buffer.from('proof audio bytes'))
      return
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/worker/v1/jobs/proof-job/downloaded'
    ) {
      state.downloaded = await readJson(request)
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({
          job: {
            id: 'proof-job',
            status: 'ready',
            chatId: 'proof-chat',
            telegramChatId: '12345',
            telegramChatType: 'private',
            sourceMessageId: 101,
            sourceKind: 'voice',
            fileSize: 17,
            recognitionLanguageHint: 'en',
            attempts: 1,
          },
        })
      )
      return
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/worker/v1/jobs/proof-job/transcribe'
    ) {
      state.transcribing = true
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({
          job: {
            id: 'proof-job',
            status: 'transcribing',
            chatId: 'proof-chat',
            telegramChatId: '12345',
            telegramChatType: 'private',
            sourceMessageId: 101,
            sourceKind: 'voice',
            fileSize: 17,
            recognitionLanguageHint: 'en',
            attempts: 1,
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createSchedulingProofServer() {
  const queue = ['slow-job', 'small-job']
  const state = {
    transcribeOrder: [],
    results: [],
  }

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1')
    if (
      !url.pathname.startsWith('/audio/') &&
      request.headers.authorization !== 'Bearer proof-worker-token'
    ) {
      response.writeHead(401, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ error: 'invalid_worker_token' }))
      return
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/worker/v1/jobs/claim-download'
    ) {
      const id = queue.shift()
      if (!id) {
        response.writeHead(204)
        response.end()
        return
      }
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({
          job: {
            id,
            status: 'downloading',
            sourceKind: 'voice',
            recognitionLanguageHint: 'en',
            attempts: 1,
          },
        })
      )
      return
    }

    const sourceMatch = url.pathname.match(
      /^\/worker\/v1\/jobs\/([^/]+)\/source$/
    )
    if (request.method === 'GET' && sourceMatch) {
      const id = sourceMatch[1]
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({
          source: {
            sourceUrl: `http://127.0.0.1:${
              server.address().port
            }/audio/${id}.ogg`,
            sourceKind: 'voice',
            mimeType: 'audio/ogg',
            fileId: id,
          },
        })
      )
      return
    }

    const audioMatch = url.pathname.match(/^\/audio\/([^/]+)\.ogg$/)
    if (request.method === 'GET' && audioMatch) {
      if (audioMatch[1] === 'slow-job') {
        await delay(200)
      }
      response.writeHead(200, { 'Content-Type': 'audio/ogg' })
      response.end(Buffer.from(`${audioMatch[1]} audio bytes`))
      return
    }

    const downloadedMatch = url.pathname.match(
      /^\/worker\/v1\/jobs\/([^/]+)\/downloaded$/
    )
    if (request.method === 'POST' && downloadedMatch) {
      const id = downloadedMatch[1]
      await readJson(request)
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({
          job: {
            id,
            status: 'ready',
            sourceKind: 'voice',
            recognitionLanguageHint: 'en',
            attempts: 1,
          },
        })
      )
      return
    }

    const transcribeMatch = url.pathname.match(
      /^\/worker\/v1\/jobs\/([^/]+)\/transcribe$/
    )
    if (request.method === 'POST' && transcribeMatch) {
      const id = transcribeMatch[1]
      state.transcribeOrder.push(id)
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({
          job: {
            id,
            status: 'transcribing',
            sourceKind: 'voice',
            recognitionLanguageHint: 'en',
            attempts: 1,
          },
        })
      )
      return
    }

    const resultMatch = url.pathname.match(
      /^\/worker\/v1\/jobs\/([^/]+)\/result$/
    )
    if (request.method === 'POST' && resultMatch) {
      state.results.push(resultMatch[1])
      await readJson(request)
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({ job: { id: resultMatch[1], status: 'completed' } })
      )
      return
    }

    const heartbeatMatch = url.pathname.match(
      /^\/worker\/v1\/jobs\/([^/]+)\/heartbeat$/
    )
    if (request.method === 'POST' && heartbeatMatch) {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ job: { id: heartbeatMatch[1] } }))
      return
    }

    const failureMatch = url.pathname.match(
      /^\/worker\/v1\/jobs\/([^/]+)\/failure$/
    )
    if (request.method === 'POST' && failureMatch) {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({ job: { id: failureMatch[1], status: 'failed' } })
      )
      return
    }

    response.writeHead(404, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ error: 'not_found' }))
  })

  return { server, state }
}

function createFairBacklogRecoveryProofServer() {
  const initialQueue = ['old-backlog-1', 'old-backlog-2']
  const state = {
    downloadClaims: [],
    transcribeOrder: [],
    results: [],
    exhaustedOnce: false,
    freshClaimed: false,
  }

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1')
    if (
      !url.pathname.startsWith('/audio/') &&
      request.headers.authorization !== 'Bearer proof-worker-token'
    ) {
      response.writeHead(401, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ error: 'invalid_worker_token' }))
      return
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/worker/v1/jobs/claim-download'
    ) {
      const body = await readJson(request)
      const bucket = body.bucket || 'oldest'
      let id = initialQueue.shift()
      if (
        !id &&
        state.exhaustedOnce &&
        bucket === 'newest' &&
        !state.freshClaimed
      ) {
        id = 'fresh-new-job'
        state.freshClaimed = true
      }
      if (!id) {
        state.exhaustedOnce = true
        response.writeHead(204)
        response.end()
        return
      }
      state.downloadClaims.push({ id, bucket })
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({
          job: {
            id,
            status: 'downloading',
            sourceKind: 'voice',
            fileSize: id === 'fresh-new-job' ? 12 : 60000000,
            recognitionLanguageHint: 'en',
            attempts: 1,
          },
        })
      )
      return
    }

    const sourceMatch = url.pathname.match(
      /^\/worker\/v1\/jobs\/([^/]+)\/source$/
    )
    if (request.method === 'GET' && sourceMatch) {
      const id = sourceMatch[1]
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({
          source: {
            sourceUrl: `http://127.0.0.1:${
              server.address().port
            }/audio/${id}.ogg`,
            sourceKind: 'voice',
            mimeType: 'audio/ogg',
            fileId: id,
          },
        })
      )
      return
    }

    const audioMatch = url.pathname.match(/^\/audio\/([^/]+)\.ogg$/)
    if (request.method === 'GET' && audioMatch) {
      response.writeHead(200, { 'Content-Type': 'audio/ogg' })
      response.end(Buffer.from(`${audioMatch[1]} audio bytes`))
      return
    }

    const downloadedMatch = url.pathname.match(
      /^\/worker\/v1\/jobs\/([^/]+)\/downloaded$/
    )
    if (request.method === 'POST' && downloadedMatch) {
      const id = downloadedMatch[1]
      await readJson(request)
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({
          job: {
            id,
            status: 'ready',
            sourceKind: 'voice',
            fileSize: id === 'fresh-new-job' ? 12 : 60000000,
            recognitionLanguageHint: 'en',
            attempts: 1,
          },
        })
      )
      return
    }

    const transcribeMatch = url.pathname.match(
      /^\/worker\/v1\/jobs\/([^/]+)\/transcribe$/
    )
    if (request.method === 'POST' && transcribeMatch) {
      const id = transcribeMatch[1]
      state.transcribeOrder.push(id)
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({
          job: {
            id,
            status: 'transcribing',
            sourceKind: 'voice',
            fileSize: id === 'fresh-new-job' ? 12 : 60000000,
            recognitionLanguageHint: 'en',
            attempts: 1,
          },
        })
      )
      return
    }

    const resultMatch = url.pathname.match(
      /^\/worker\/v1\/jobs\/([^/]+)\/result$/
    )
    if (request.method === 'POST' && resultMatch) {
      state.results.push(resultMatch[1])
      await readJson(request)
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({ job: { id: resultMatch[1], status: 'completed' } })
      )
      return
    }

    const heartbeatMatch = url.pathname.match(
      /^\/worker\/v1\/jobs\/([^/]+)\/heartbeat$/
    )
    if (request.method === 'POST' && heartbeatMatch) {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ job: { id: heartbeatMatch[1] } }))
      return
    }

    if (request.method === 'POST' && url.pathname === '/worker/v1/jobs/claim') {
      response.writeHead(204)
      response.end()
      return
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/worker/v1/jobs/claim-ready'
    ) {
      await readJson(request)
      response.writeHead(204)
      response.end()
      return
    }

    response.writeHead(404, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ error: 'not_found' }))
  })

  return { server, state }
}

function createRestartProofServer() {
  const state = {
    claimDownloadAttempts: 0,
    legacyClaimAttempts: 0,
    recovered: false,
  }

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1')
    if (request.headers.authorization !== 'Bearer proof-worker-token') {
      response.writeHead(401, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ error: 'invalid_worker_token' }))
      return
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/worker/v1/jobs/claim-download'
    ) {
      state.claimDownloadAttempts += 1
      if (state.claimDownloadAttempts === 1) {
        response.writeHead(500, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ error: 'proof_crash' }))
        return
      }

      response.writeHead(204)
      response.end()
      return
    }

    if (request.method === 'POST' && url.pathname === '/worker/v1/jobs/claim') {
      state.legacyClaimAttempts += 1
      state.recovered = true
      response.writeHead(204)
      response.end()
      return
    }

    response.writeHead(404, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ error: 'not_found' }))
  })

  return { server, state }
}

function createStaleWorkerProofServer(mode) {
  const ids =
    mode === 'start' ? ['stale-start-job', 'later-job'] : [`stale-${mode}-job`]
  const queue = [...ids]
  const state = {
    claimed: [],
    downloaded: [],
    transcribeAttempts: [],
    results: [],
    failures: [],
    heartbeats: 0,
  }

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1')
    if (
      !url.pathname.startsWith('/audio/') &&
      request.headers.authorization !== 'Bearer proof-worker-token'
    ) {
      response.writeHead(401, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ error: 'invalid_worker_token' }))
      return
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/worker/v1/jobs/claim-download'
    ) {
      const id = queue.shift()
      if (!id) {
        response.writeHead(204)
        response.end()
        return
      }
      state.claimed.push(id)
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({
          job: {
            id,
            status: 'downloading',
            chatId: 'stale-chat',
            sourceKind: 'voice',
            fileSize: 17,
            recognitionLanguageHint: 'en',
            attempts: 1,
          },
        })
      )
      return
    }

    const sourceMatch = url.pathname.match(
      /^\/worker\/v1\/jobs\/([^/]+)\/source$/
    )
    if (request.method === 'GET' && sourceMatch) {
      const id = sourceMatch[1]
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({
          source: {
            sourceUrl: `http://127.0.0.1:${
              server.address().port
            }/audio/${id}.ogg`,
            sourceKind: 'voice',
            mimeType: 'audio/ogg',
          },
        })
      )
      return
    }

    const audioMatch = url.pathname.match(/^\/audio\/([^/]+)\.ogg$/)
    if (request.method === 'GET' && audioMatch) {
      response.writeHead(200, { 'Content-Type': 'audio/ogg' })
      response.end(Buffer.from(`${audioMatch[1]} audio bytes`))
      return
    }

    const downloadedMatch = url.pathname.match(
      /^\/worker\/v1\/jobs\/([^/]+)\/downloaded$/
    )
    if (request.method === 'POST' && downloadedMatch) {
      const id = downloadedMatch[1]
      await readJson(request)
      state.downloaded.push(id)
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({
          job: {
            id,
            status: 'ready',
            chatId: 'stale-chat',
            sourceKind: 'voice',
            fileSize: 17,
            recognitionLanguageHint: 'en',
            attempts: 1,
          },
        })
      )
      return
    }

    const transcribeMatch = url.pathname.match(
      /^\/worker\/v1\/jobs\/([^/]+)\/transcribe$/
    )
    if (request.method === 'POST' && transcribeMatch) {
      const id = transcribeMatch[1]
      state.transcribeAttempts.push(id)
      if (mode === 'start' && id === 'stale-start-job') {
        response.writeHead(404, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ error: 'job_not_found' }))
        return
      }
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({
          job: {
            id,
            status: 'transcribing',
            chatId: 'stale-chat',
            sourceKind: 'voice',
            fileSize: 17,
            recognitionLanguageHint: 'en',
            attempts: 1,
          },
        })
      )
      return
    }

    const heartbeatMatch = url.pathname.match(
      /^\/worker\/v1\/jobs\/([^/]+)\/heartbeat$/
    )
    if (request.method === 'POST' && heartbeatMatch) {
      state.heartbeats += 1
      if (mode === 'heartbeat') {
        response.writeHead(404, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ error: 'job_not_found' }))
        return
      }
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ job: { id: heartbeatMatch[1] } }))
      return
    }

    const resultMatch = url.pathname.match(
      /^\/worker\/v1\/jobs\/([^/]+)\/result$/
    )
    if (request.method === 'POST' && resultMatch) {
      const body = await readJson(request)
      if (mode === 'result') {
        response.writeHead(404, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ error: 'job_not_found' }))
        return
      }
      state.results.push({ id: resultMatch[1], body })
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({ job: { id: resultMatch[1], status: 'completed' } })
      )
      return
    }

    const failureMatch = url.pathname.match(
      /^\/worker\/v1\/jobs\/([^/]+)\/failure$/
    )
    if (request.method === 'POST' && failureMatch) {
      const body = await readJson(request)
      if (mode === 'failure') {
        response.writeHead(404, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ error: 'job_not_found' }))
        return
      }
      state.failures.push({ id: failureMatch[1], body })
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(
        JSON.stringify({ job: { id: failureMatch[1], status: 'failed' } })
      )
      return
    }

    if (request.method === 'POST' && url.pathname === '/worker/v1/jobs/claim') {
      response.writeHead(204)
      response.end()
      return
    }

    response.writeHead(404, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ error: 'not_found' }))
  })

  return { server, state }
}

function staleWorkerLogs(logLines, phase, action) {
  return logLines.filter(
    (line) =>
      line.includes('Worker stale job ignored') &&
      line.includes(`phase="${phase}"`) &&
      line.includes(`action="${action}"`) &&
      line.includes('backendError="job_not_found"')
  )
}

async function main() {
  const { server, state } = createProofServer()
  await listen(server)

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}/worker/v1`
    const shellSensitiveWorkDir = path.join(
      os.tmpdir(),
      `voicy worker proof ' "$\`$(x)-${process.pid}`
    )
    const env = {
      VOICY_WORKER_API_URL: baseUrl,
      VOICY_WORKER_TOKEN: 'proof-worker-token',
      VOICY_WORKER_TRANSCRIBE_EXECUTABLE: process.execPath,
      VOICY_WORKER_TRANSCRIBE_ARGS_JSON: JSON.stringify([
        'scripts/fake-transcriber.js',
        '{input}',
        '{output}',
        '{model}',
      ]),
      VOICY_WORKER_WORK_DIR: shellSensitiveWorkDir,
      VOICY_WORKER_IDLE_EXIT: '1',
      VOICY_WORKER_ENGINE: 'proof-engine',
      VOICY_WORKER_MODEL: 'proof-model',
      VOICY_WORKER_TELEGRAM_API_URL: `http://127.0.0.1:${
        server.address().port
      }`,
      VOICY_WORKER_TELEGRAM_BOT_TOKEN: 'proof-telegram-token',
    }
    const config = loadConfig(env)
    const logLines = []
    const transcriptText =
      'fake transcript from worker client proof with token 123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabc'
    const previousFakeTranscriptText = process.env.VOICY_FAKE_TRANSCRIPT_TEXT
    process.env.VOICY_FAKE_TRANSCRIPT_TEXT = transcriptText
    let processed
    try {
      processed = await processNextJob(config, {
        info: (message) => logLines.push(message),
        warn: (message) => logLines.push(message),
        error: (message) => logLines.push(message),
      })
    } finally {
      if (previousFakeTranscriptText === undefined) {
        delete process.env.VOICY_FAKE_TRANSCRIPT_TEXT
      } else {
        process.env.VOICY_FAKE_TRANSCRIPT_TEXT = previousFakeTranscriptText
      }
    }

    assert(processed, 'worker should process the claimed job')
    assert(
      logLines.every(
        (line) =>
          !line.includes('proof-telegram-token') &&
          !line.includes('api.telegram.org/file') &&
          !line.includes('123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabc')
      ),
      'worker activity logs should not include tokens, source URLs, or unredacted sensitive transcript text'
    )
    assert(
      logLines.some(
        (line) =>
          line.includes('Worker transcription job completed') &&
          line.includes(
            'transcriptionResult="fake transcript from worker client proof with [redacted-secret]"'
          )
      ),
      'worker completion logs should include redacted final transcript text'
    )
    assert(
      logLines.some(
        (line) =>
          line.includes('Worker media download job claimed') &&
          line.includes('jobId="proof-job"') &&
          line.includes('chatId="proof-chat"') &&
          line.includes('telegramChatId="12345"') &&
          line.includes('sourceMessageId=101') &&
          line.includes('sourceKind="voice"') &&
          line.includes('fileSize=17')
      ),
      'worker should log media claim context'
    )
    assert(
      logLines.some(
        (line) =>
          line.includes('Worker transcription job started') &&
          line.includes('jobId="proof-job"') &&
          line.includes('engine="proof-engine"') &&
          line.includes('model="proof-model"') &&
          line.includes('sourceKind="voice"') &&
          line.includes('fileSize=17')
      ),
      'worker should log transcription job start context'
    )
    assert(
      logLines.some(
        (line) =>
          line.includes('Worker transcription command starting') &&
          line.includes('jobId="proof-job"') &&
          line.includes('engine="proof-engine"') &&
          line.includes('model="proof-model"') &&
          line.includes('language="en"')
      ),
      'worker should log transcription command start context'
    )
    assert(
      logLines.some(
        (line) =>
          line.includes('Worker transcription command completed') &&
          line.includes('jobId="proof-job"') &&
          line.includes('outputSource="file"') &&
          line.includes(`textChars=${transcriptText.length}`) &&
          line.includes('parts=1')
      ),
      'worker should log transcription command completion metrics'
    )
    assert(
      logLines.some(
        (line) =>
          line.includes('Worker transcription result uploading') &&
          line.includes('jobId="proof-job"') &&
          line.includes('sourceKind="voice"') &&
          line.includes('detectedLanguage="en"') &&
          line.includes(`textChars=${transcriptText.length}`) &&
          line.includes('emptyResult=false')
      ),
      'worker should log transcription result upload metrics'
    )
    assert(
      logLines.some(
        (line) =>
          line.includes('Worker transcription job completed') &&
          line.includes('jobId="proof-job"') &&
          line.includes('sourceKind="voice"') &&
          line.includes('detectedLanguage="en"') &&
          line.includes(`textChars=${transcriptText.length}`) &&
          line.includes('emptyResult=false')
      ),
      'worker should log transcription job completion metrics'
    )
    assert(
      !state.failure,
      `worker should not report failure: ${JSON.stringify(state.failure)}`
    )
    assert(state.downloaded, 'worker should mark media downloaded before STT')
    assert(
      state.transcribing,
      'worker should start transcription after download'
    )
    assert(state.result, 'worker should submit a result')
    assert(
      state.result.text === transcriptText,
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
      state.result.metadata.inputPath.includes(shellSensitiveWorkDir),
      'worker should pass shell-sensitive input paths as a single argv value'
    )
    assert(
      state.result.metadata.outputPath.includes(shellSensitiveWorkDir),
      'worker should pass shell-sensitive output paths as a single argv value'
    )
    assert(
      state.result.metadata.argv[0].includes(shellSensitiveWorkDir) &&
        state.result.metadata.argv[1].includes(shellSensitiveWorkDir),
      'worker transcriber argv should preserve spaces, quotes, dollar signs, backticks, and parentheses'
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

  const localTelegramDir = fs.mkdtempSync(
    path.join(os.tmpdir(), `voicy-worker-local-telegram-proof-${process.pid}-`)
  )
  const localTelegramFile = path.join(localTelegramDir, 'telegram-local.ogg')
  fs.writeFileSync(localTelegramFile, Buffer.from('local telegram api bytes'))
  const localTelegramProof = createProofServer({
    telegramFilePath: localTelegramFile,
  })
  await listen(localTelegramProof.server)

  try {
    const baseUrl = `http://127.0.0.1:${
      localTelegramProof.server.address().port
    }/worker/v1`
    const config = loadConfig({
      VOICY_WORKER_API_URL: baseUrl,
      VOICY_WORKER_TOKEN: 'proof-worker-token',
      VOICY_WORKER_TRANSCRIBE_EXECUTABLE: process.execPath,
      VOICY_WORKER_TRANSCRIBE_ARGS_JSON: JSON.stringify([
        'scripts/fake-transcriber.js',
        '{input}',
        '{output}',
        '{model}',
      ]),
      VOICY_WORKER_WORK_DIR: path.join(
        os.tmpdir(),
        `voicy-worker-local-telegram-output-${process.pid}`
      ),
      VOICY_WORKER_IDLE_EXIT: '1',
      VOICY_WORKER_TELEGRAM_API_URL: `http://127.0.0.1:${
        localTelegramProof.server.address().port
      }`,
      VOICY_WORKER_TELEGRAM_BOT_TOKEN: 'proof-telegram-token',
    })

    const processed = await processNextJob(config, {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    })

    assert(
      processed,
      'worker should process local Telegram Bot API file_path jobs'
    )
    assert(
      localTelegramProof.state.fileDownloadRequests === 0,
      'worker should copy absolute local Telegram file_path instead of requesting /file/bot'
    )
    assert(
      localTelegramProof.state.downloaded,
      'local Telegram file_path job should mark media downloaded'
    )
    assert(
      localTelegramProof.state.result,
      'local Telegram file_path job should submit a result'
    )
    assert(
      !localTelegramProof.state.failure,
      `local Telegram file_path job should not fail: ${JSON.stringify(
        localTelegramProof.state.failure
      )}`
    )
  } finally {
    await close(localTelegramProof.server)
    fs.rmSync(localTelegramDir, { recursive: true, force: true })
  }

  const emptyProof = createProofServer()
  await listen(emptyProof.server)

  try {
    const baseUrl = `http://127.0.0.1:${
      emptyProof.server.address().port
    }/worker/v1`
    const config = loadConfig({
      VOICY_WORKER_API_URL: baseUrl,
      VOICY_WORKER_TOKEN: 'proof-worker-token',
      VOICY_WORKER_TRANSCRIBE_EXECUTABLE: process.execPath,
      VOICY_WORKER_TRANSCRIBE_ARGS_JSON: JSON.stringify([
        '-e',
        "process.stdout.write(JSON.stringify({ text: '', parts: [], language: 'en', duration: 0.1 }))",
      ]),
      VOICY_WORKER_WORK_DIR: path.join(
        os.tmpdir(),
        `voicy-worker-empty-proof-${process.pid}`
      ),
      VOICY_WORKER_TELEGRAM_API_URL: `http://127.0.0.1:${
        emptyProof.server.address().port
      }`,
      VOICY_WORKER_TELEGRAM_BOT_TOKEN: 'proof-telegram-token',
    })

    const emptyLogLines = []
    const processed = await processNextJob(config, {
      info: (message) => emptyLogLines.push(message),
      warn: (message) => emptyLogLines.push(message),
      error: (message) => emptyLogLines.push(message),
    })

    assert(processed, 'worker should process the empty transcript job')
    assert(
      !emptyProof.state.failure,
      `empty transcript should not report failure: ${JSON.stringify(
        emptyProof.state.failure
      )}`
    )
    assert(emptyProof.state.result, 'empty transcript should submit a result')
    assert(
      emptyProof.state.result.text === '',
      'empty transcript should submit empty result text for backend fallback copy'
    )
    assert(
      emptyLogLines.some(
        (line) =>
          line.includes('Worker transcription job completed') &&
          line.includes('emptyResult=true') &&
          line.includes('transcriptionResult=""')
      ),
      'empty transcript completion log should explicitly show an empty final result'
    )
  } finally {
    await close(emptyProof.server)
  }

  const nonZeroOutputProof = createProofServer()
  await listen(nonZeroOutputProof.server)

  try {
    const baseUrl = `http://127.0.0.1:${
      nonZeroOutputProof.server.address().port
    }/worker/v1`
    const config = loadConfig({
      VOICY_WORKER_API_URL: baseUrl,
      VOICY_WORKER_TOKEN: 'proof-worker-token',
      VOICY_WORKER_TRANSCRIBE_EXECUTABLE: process.execPath,
      VOICY_WORKER_TRANSCRIBE_ARGS_JSON: JSON.stringify([
        '-e',
        [
          "const fs = require('fs')",
          "fs.writeFileSync(process.argv[2], JSON.stringify({ text: 'recovered transcript', parts: [], language: 'en', duration: 1 }))",
          'process.exit(7)',
        ].join('; '),
        '{input}',
        '{output}',
      ]),
      VOICY_WORKER_WORK_DIR: path.join(
        os.tmpdir(),
        `voicy-worker-nonzero-output-proof-${process.pid}`
      ),
      VOICY_WORKER_TELEGRAM_API_URL: `http://127.0.0.1:${
        nonZeroOutputProof.server.address().port
      }`,
      VOICY_WORKER_TELEGRAM_BOT_TOKEN: 'proof-telegram-token',
    })

    const nonZeroLogLines = []
    const processed = await processNextJob(config, {
      info: (message) => nonZeroLogLines.push(message),
      warn: (message) => nonZeroLogLines.push(message),
      error: (message) => nonZeroLogLines.push(message),
    })

    assert(
      processed,
      'worker should process the non-zero command with valid output'
    )
    assert(
      !nonZeroOutputProof.state.failure,
      `non-zero command with valid output should not report failure: ${JSON.stringify(
        nonZeroOutputProof.state.failure
      )}`
    )
    assert(
      nonZeroOutputProof.state.result?.text === 'recovered transcript',
      'worker should submit valid transcript output even when the command exits non-zero'
    )
    assert(
      nonZeroLogLines.some(
        (line) =>
          line.includes('Worker transcription command completed') &&
          line.includes('exitCode=7') &&
          line.includes('outputSource="file"')
      ),
      'worker should log the recovered non-zero exit code with file output'
    )
  } finally {
    await close(nonZeroOutputProof.server)
  }

  const largeOutputFileProof = createProofServer()
  await listen(largeOutputFileProof.server)

  try {
    const baseUrl = `http://127.0.0.1:${
      largeOutputFileProof.server.address().port
    }/worker/v1`
    const config = loadConfig({
      VOICY_WORKER_API_URL: baseUrl,
      VOICY_WORKER_TOKEN: 'proof-worker-token',
      VOICY_WORKER_TRANSCRIBE_EXECUTABLE: process.execPath,
      VOICY_WORKER_TRANSCRIBE_ARGS_JSON: JSON.stringify([
        '-e',
        [
          "const fs = require('fs')",
          "process.stdout.write('p'.repeat(2 * 1024 * 1024))",
          "process.stderr.write('s'.repeat(2 * 1024 * 1024))",
          "fs.writeFileSync(process.argv[2], JSON.stringify({ text: 'large output file transcript', parts: [], language: 'en', duration: 2 }))",
        ].join('; '),
        '{input}',
        '{output}',
      ]),
      VOICY_WORKER_WORK_DIR: path.join(
        os.tmpdir(),
        `voicy-worker-large-output-file-proof-${process.pid}`
      ),
      VOICY_WORKER_TELEGRAM_API_URL: `http://127.0.0.1:${
        largeOutputFileProof.server.address().port
      }`,
      VOICY_WORKER_TELEGRAM_BOT_TOKEN: 'proof-telegram-token',
    })

    const largeOutputLogLines = []
    const processed = await processNextJob(config, {
      info: (message) => largeOutputLogLines.push(message),
      warn: (message) => largeOutputLogLines.push(message),
      error: (message) => largeOutputLogLines.push(message),
    })

    assert(processed, 'large output-file proof should process the job')
    assert(
      !largeOutputFileProof.state.failure,
      `large output-file proof should not fail: ${JSON.stringify(
        largeOutputFileProof.state.failure
      )}`
    )
    assert(
      largeOutputFileProof.state.result?.text ===
        'large output file transcript',
      'worker should preserve output-file transcript parsing when stdout/stderr are huge'
    )
    assert(
      largeOutputLogLines.some(
        (line) =>
          line.includes('Worker transcription command completed') &&
          line.includes('outputSource="file"') &&
          line.includes('stdoutBytes=2097152') &&
          line.includes('stderrBytes=2097152') &&
          line.includes('stdoutTruncated=true') &&
          line.includes('stderrTruncated=true')
      ),
      'worker should log bounded capture metrics for huge child-process output'
    )
  } finally {
    await close(largeOutputFileProof.server)
  }

  const largeStdoutFallbackProof = createProofServer()
  await listen(largeStdoutFallbackProof.server)

  try {
    const baseUrl = `http://127.0.0.1:${
      largeStdoutFallbackProof.server.address().port
    }/worker/v1`
    const config = loadConfig({
      VOICY_WORKER_API_URL: baseUrl,
      VOICY_WORKER_TOKEN: 'proof-worker-token',
      VOICY_WORKER_TRANSCRIBE_EXECUTABLE: process.execPath,
      VOICY_WORKER_TRANSCRIBE_ARGS_JSON: JSON.stringify([
        '-e',
        "process.stdout.write('x'.repeat(2 * 1024 * 1024))",
      ]),
      VOICY_WORKER_WORK_DIR: path.join(
        os.tmpdir(),
        `voicy-worker-large-stdout-fallback-proof-${process.pid}`
      ),
      VOICY_WORKER_TELEGRAM_API_URL: `http://127.0.0.1:${
        largeStdoutFallbackProof.server.address().port
      }`,
      VOICY_WORKER_TELEGRAM_BOT_TOKEN: 'proof-telegram-token',
    })

    const processed = await processNextJob(config, {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    })

    assert(processed, 'large stdout fallback proof should claim the job')
    assert(
      !largeStdoutFallbackProof.state.result,
      'oversized stdout fallback should not submit a partial result'
    )
    assert(
      largeStdoutFallbackProof.state.failure,
      'oversized stdout fallback should report a controlled failure'
    )
    assert(
      largeStdoutFallbackProof.state.failure.retryable === false,
      'oversized stdout fallback should be a non-retryable worker config failure'
    )
    assert(
      largeStdoutFallbackProof.state.failure.error.includes(
        'stdout exceeded safe capture limit'
      ) &&
        largeStdoutFallbackProof.state.failure.error.includes(
          'stdoutBytes=2097152'
        ),
      'oversized stdout fallback should explain the safe output-file path'
    )
  } finally {
    await close(largeStdoutFallbackProof.server)
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
      VOICY_WORKER_TRANSCRIBE_EXECUTABLE: process.execPath,
      VOICY_WORKER_TRANSCRIBE_ARGS_JSON: JSON.stringify([
        '-e',
        'process.stdout.write("PRIVATE TRANSCRIPT"); process.stderr.write("PRIVATE STDERR"); process.exit(3)',
      ]),
      VOICY_WORKER_WORK_DIR: path.join(
        os.tmpdir(),
        `voicy-worker-failure-proof-${process.pid}`
      ),
      VOICY_WORKER_TELEGRAM_API_URL: `http://127.0.0.1:${
        failureProof.server.address().port
      }`,
      VOICY_WORKER_TELEGRAM_BOT_TOKEN: 'proof-telegram-token',
    })

    const failureLogLines = []
    const processed = await processNextJob(config, {
      info: (message) => failureLogLines.push(message),
      warn: (message) => failureLogLines.push(message),
      error: (message) => failureLogLines.push(message),
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
    assert(
      failureProof.state.failure.error.includes('stdoutChars=18') &&
        failureProof.state.failure.error.includes('stderrChars=14'),
      'failed command should report output lengths for diagnostics'
    )
    assert(
      !failureProof.state.failure.error.includes('PRIVATE TRANSCRIPT') &&
        !failureProof.state.failure.error.includes('PRIVATE STDERR'),
      'failed command should not report raw stdout or stderr'
    )
    assert(
      failureLogLines.every(
        (line) =>
          !line.includes('PRIVATE TRANSCRIPT') &&
          !line.includes('PRIVATE STDERR')
      ),
      'failed command logs should not include raw stdout or stderr'
    )
  } finally {
    await close(failureProof.server)
  }

  const staleStartProof = createStaleWorkerProofServer('start')
  await listen(staleStartProof.server)

  try {
    const baseUrl = `http://127.0.0.1:${
      staleStartProof.server.address().port
    }/worker/v1`
    const staleStartLogLines = []
    const processed = await processAvailableJobs(
      loadConfig({
        VOICY_WORKER_API_URL: baseUrl,
        VOICY_WORKER_TOKEN: 'proof-worker-token',
        VOICY_WORKER_TRANSCRIBE_EXECUTABLE: process.execPath,
        VOICY_WORKER_TRANSCRIBE_ARGS_JSON: JSON.stringify([
          'scripts/fake-transcriber.js',
          '{input}',
          '{output}',
        ]),
        VOICY_WORKER_WORK_DIR: path.join(
          os.tmpdir(),
          `voicy-worker-stale-start-proof-${process.pid}`
        ),
        VOICY_WORKER_DOWNLOAD_CONCURRENCY: '1',
        VOICY_WORKER_TRANSCRIPTION_CONCURRENCY: '1',
      }),
      {
        info: (message) => staleStartLogLines.push(message),
        warn: (message) => staleStartLogLines.push(message),
        error: (message) => staleStartLogLines.push(message),
      }
    )

    assert(
      processed === 2,
      'stale start proof should still count both claimed jobs'
    )
    assert(
      staleStartProof.state.results.length === 1 &&
        staleStartProof.state.results[0].id === 'later-job',
      'worker should keep processing later jobs after stale start'
    )
    assert(
      staleStartProof.state.failures.length === 0,
      'stale start should not report job failure'
    )
    assert(
      staleWorkerLogs(
        staleStartLogLines,
        'transcription',
        'start_transcription'
      ).length === 1,
      'stale start should log one structured stale-job line'
    )
  } finally {
    await close(staleStartProof.server)
  }

  const staleResultProof = createStaleWorkerProofServer('result')
  await listen(staleResultProof.server)

  try {
    const baseUrl = `http://127.0.0.1:${
      staleResultProof.server.address().port
    }/worker/v1`
    const staleResultLogLines = []
    const staleTranscriptText =
      'stale result transcript 123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabc'
    const previousFakeTranscriptText = process.env.VOICY_FAKE_TRANSCRIPT_TEXT
    process.env.VOICY_FAKE_TRANSCRIPT_TEXT = staleTranscriptText
    try {
      const processed = await processNextJob(
        loadConfig({
          VOICY_WORKER_API_URL: baseUrl,
          VOICY_WORKER_TOKEN: 'proof-worker-token',
          VOICY_WORKER_TRANSCRIBE_EXECUTABLE: process.execPath,
          VOICY_WORKER_TRANSCRIBE_ARGS_JSON: JSON.stringify([
            'scripts/fake-transcriber.js',
            '{input}',
            '{output}',
          ]),
          VOICY_WORKER_WORK_DIR: path.join(
            os.tmpdir(),
            `voicy-worker-stale-result-proof-${process.pid}`
          ),
        }),
        {
          info: (message) => staleResultLogLines.push(message),
          warn: (message) => staleResultLogLines.push(message),
          error: (message) => staleResultLogLines.push(message),
        }
      )
      assert(processed, 'stale result proof should claim a job')
    } finally {
      if (previousFakeTranscriptText === undefined) {
        delete process.env.VOICY_FAKE_TRANSCRIPT_TEXT
      } else {
        process.env.VOICY_FAKE_TRANSCRIPT_TEXT = previousFakeTranscriptText
      }
    }

    assert(
      staleResultProof.state.failures.length === 0,
      'stale result should not report job failure'
    )
    assert(
      staleWorkerLogs(staleResultLogLines, 'result_upload', 'upload_result')
        .length === 1,
      'stale result should log one structured stale-job line'
    )
    assert(
      staleResultLogLines.every((line) => !line.includes(staleTranscriptText)),
      'stale result logs should not include raw transcript text'
    )
  } finally {
    await close(staleResultProof.server)
  }

  const staleHeartbeatProof = createStaleWorkerProofServer('heartbeat')
  await listen(staleHeartbeatProof.server)

  try {
    const baseUrl = `http://127.0.0.1:${
      staleHeartbeatProof.server.address().port
    }/worker/v1`
    const staleHeartbeatLogLines = []
    const processed = await processNextJob(
      loadConfig({
        VOICY_WORKER_API_URL: baseUrl,
        VOICY_WORKER_TOKEN: 'proof-worker-token',
        VOICY_WORKER_TRANSCRIBE_EXECUTABLE: process.execPath,
        VOICY_WORKER_TRANSCRIBE_ARGS_JSON: JSON.stringify([
          '-e',
          "setTimeout(() => process.stdout.write(JSON.stringify({ text: 'heartbeat stale transcript', parts: [], language: 'en' })), 200)",
        ]),
        VOICY_WORKER_WORK_DIR: path.join(
          os.tmpdir(),
          `voicy-worker-stale-heartbeat-proof-${process.pid}`
        ),
        VOICY_WORKER_HEARTBEAT_INTERVAL_MS: '1',
      }),
      {
        info: (message) => staleHeartbeatLogLines.push(message),
        warn: (message) => staleHeartbeatLogLines.push(message),
        error: (message) => staleHeartbeatLogLines.push(message),
      }
    )

    assert(processed, 'stale heartbeat proof should claim a job')
    assert(
      staleHeartbeatProof.state.heartbeats >= 1,
      'stale heartbeat proof should exercise the heartbeat endpoint'
    )
    assert(
      staleHeartbeatProof.state.results.length === 0,
      'stale heartbeat should drop the finished local result'
    )
    assert(
      staleHeartbeatProof.state.failures.length === 0,
      'stale heartbeat should not report job failure'
    )
    assert(
      staleWorkerLogs(staleHeartbeatLogLines, 'heartbeat', 'heartbeat')
        .length >= 1,
      'stale heartbeat should log structured stale-job lines'
    )
  } finally {
    await close(staleHeartbeatProof.server)
  }

  const staleFailureProof = createStaleWorkerProofServer('failure')
  await listen(staleFailureProof.server)

  try {
    const baseUrl = `http://127.0.0.1:${
      staleFailureProof.server.address().port
    }/worker/v1`
    const staleFailureLogLines = []
    const processed = await processNextJob(
      loadConfig({
        VOICY_WORKER_API_URL: baseUrl,
        VOICY_WORKER_TOKEN: 'proof-worker-token',
        VOICY_WORKER_TRANSCRIBE_EXECUTABLE: process.execPath,
        VOICY_WORKER_TRANSCRIBE_ARGS_JSON: JSON.stringify([
          '-e',
          'process.stdout.write("PRIVATE STALE FAILURE TRANSCRIPT"); process.exit(3)',
        ]),
        VOICY_WORKER_WORK_DIR: path.join(
          os.tmpdir(),
          `voicy-worker-stale-failure-proof-${process.pid}`
        ),
      }),
      {
        info: (message) => staleFailureLogLines.push(message),
        warn: (message) => staleFailureLogLines.push(message),
        error: (message) => staleFailureLogLines.push(message),
      }
    )

    assert(processed, 'stale failure proof should claim a job')
    assert(
      staleFailureProof.state.results.length === 0,
      'failed stale job should not submit result'
    )
    assert(
      staleFailureProof.state.failures.length === 0,
      'stale failure report should not be accepted as a normal failure'
    )
    assert(
      staleWorkerLogs(staleFailureLogLines, 'failure_report', 'report_failure')
        .length === 1,
      'stale failure report should log one structured stale-job line'
    )
    assert(
      staleFailureLogLines.every(
        (line) => !line.includes('PRIVATE STALE FAILURE TRANSCRIPT')
      ),
      'stale failure logs should not include raw transcript output'
    )
  } finally {
    await close(staleFailureProof.server)
  }

  const schedulingProof = createSchedulingProofServer()
  await listen(schedulingProof.server)

  try {
    const baseUrl = `http://127.0.0.1:${
      schedulingProof.server.address().port
    }/worker/v1`
    const processed = await processAvailableJobs(
      loadConfig({
        VOICY_WORKER_API_URL: baseUrl,
        VOICY_WORKER_TOKEN: 'proof-worker-token',
        VOICY_WORKER_TRANSCRIBE_EXECUTABLE: process.execPath,
        VOICY_WORKER_TRANSCRIBE_ARGS_JSON: JSON.stringify([
          'scripts/fake-transcriber.js',
          '{input}',
          '{output}',
        ]),
        VOICY_WORKER_WORK_DIR: path.join(
          os.tmpdir(),
          `voicy-worker-scheduling-proof-${process.pid}`
        ),
        VOICY_WORKER_DOWNLOAD_CONCURRENCY: '2',
        VOICY_WORKER_TRANSCRIPTION_CONCURRENCY: '1',
      }),
      {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      }
    )

    assert(processed === 2, 'scheduler should process both claimed jobs')
    assert(
      schedulingProof.state.transcribeOrder[0] === 'small-job',
      'small downloaded job should transcribe before slow large download'
    )
    assert(
      schedulingProof.state.results.length === 2,
      'scheduler should upload both results'
    )
  } finally {
    await close(schedulingProof.server)
  }

  const fairBacklogProof = createFairBacklogRecoveryProofServer()
  await listen(fairBacklogProof.server)

  try {
    const baseUrl = `http://127.0.0.1:${
      fairBacklogProof.server.address().port
    }/worker/v1`
    const fairLogLines = []
    const processed = await processAvailableJobs(
      loadConfig({
        VOICY_WORKER_API_URL: baseUrl,
        VOICY_WORKER_TOKEN: 'proof-worker-token',
        VOICY_WORKER_TRANSCRIBE_EXECUTABLE: process.execPath,
        VOICY_WORKER_TRANSCRIBE_ARGS_JSON: JSON.stringify([
          'scripts/fake-transcriber.js',
          '{input}',
          '{output}',
        ]),
        VOICY_WORKER_WORK_DIR: path.join(
          os.tmpdir(),
          `voicy-worker-fair-backlog-proof-${process.pid}`
        ),
        VOICY_WORKER_DOWNLOAD_CONCURRENCY: '1',
        VOICY_WORKER_TRANSCRIPTION_CONCURRENCY: '1',
        VOICY_WORKER_READY_QUEUE_LIMIT: '2',
      }),
      {
        info: (message) => fairLogLines.push(message),
        warn: (message) => fairLogLines.push(message),
        error: (message) => fairLogLines.push(message),
      }
    )

    assert(processed === 3, 'fair scheduler should process all claimed jobs')
    assert(
      fairBacklogProof.state.transcribeOrder.join(',') ===
        'old-backlog-1,fresh-new-job,old-backlog-2',
      `fresh job should alternate in before the older ready backlog drains: ${fairBacklogProof.state.transcribeOrder.join(
        ','
      )}`
    )
    assert(
      fairBacklogProof.state.downloadClaims.some(
        (claim) => claim.id === 'fresh-new-job' && claim.bucket === 'newest'
      ),
      'fresh post-exhaustion job should be claimed from the newest bucket'
    )
    assert(
      fairLogLines.some(
        (line) =>
          line.includes('Worker download queue exhausted') &&
          line.includes('queuedReadyJobs=1')
      ),
      'worker should log bounded backlog state when downloads are exhausted'
    )
    assert(
      fairLogLines.some(
        (line) =>
          line.includes('Worker transcription scheduler selected job') &&
          line.includes('jobId="fresh-new-job"') &&
          line.includes('schedulingBucket="newest"')
      ),
      'worker should log the scheduling bucket for the fresh job'
    )
  } finally {
    await close(fairBacklogProof.server)
  }

  const restartProof = createRestartProofServer()
  await listen(restartProof.server)

  try {
    const baseUrl = `http://127.0.0.1:${
      restartProof.server.address().port
    }/worker/v1`
    const restartLogLines = []
    await runWorker(
      loadConfig({
        VOICY_WORKER_API_URL: baseUrl,
        VOICY_WORKER_TOKEN: 'proof-worker-token',
        VOICY_WORKER_TRANSCRIBE_EXECUTABLE: process.execPath,
        VOICY_WORKER_TRANSCRIBE_ARGS_JSON: JSON.stringify([
          'scripts/fake-transcriber.js',
          '{input}',
          '{output}',
        ]),
        VOICY_WORKER_WORK_DIR: path.join(
          os.tmpdir(),
          `voicy-worker-restart-proof-${process.pid}`
        ),
        VOICY_WORKER_POLL_INTERVAL_MS: '1',
        VOICY_WORKER_RESTART_DELAY_MS: '1',
      }),
      {
        info: (message) => restartLogLines.push(message),
        warn: (message) => restartLogLines.push(message),
        error: (message) => restartLogLines.push(message),
      },
      () => restartProof.state.recovered
    )

    assert(
      restartProof.state.claimDownloadAttempts >= 2,
      'worker should retry polling after a loop crash'
    )
    assert(
      restartProof.state.recovered,
      'worker should recover after the crashed poll cycle'
    )
    assert(
      restartLogLines.some((line) =>
        line.includes('Worker loop crashed; restarting in 1ms: crashCount=1')
      ),
      'worker should log crashed loops before restarting'
    )
  } finally {
    await close(restartProof.server)
  }

  const supervisorScript = fs.readFileSync(
    path.join(__dirname, 'run-windows-worker.ps1'),
    'utf8'
  )
  const installerScript = fs.readFileSync(
    path.join(__dirname, 'install-windows-worker.ps1'),
    'utf8'
  )
  assert(
    supervisorScript.includes('while ($true)') &&
      supervisorScript.includes('Worker crashed exitCode=') &&
      supervisorScript.includes('Start-Sleep -Seconds $RestartDelaySeconds'),
    'Windows worker supervisor should restart crashed worker commands with logged backoff'
  )
  assert(
    supervisorScript.includes('Repeated worker failures reached threshold'),
    'Windows worker supervisor should make repeated failures visible in logs'
  )
  assert(
    installerScript.includes('New-ScheduledTaskSettingsSet') &&
      installerScript.includes('-RestartCount 999') &&
      installerScript.includes('-UserId "SYSTEM"') &&
      installerScript.includes('run-windows-worker.ps1'),
    'Windows worker installer should register a restartable scheduled task'
  )
  assert(
    installerScript.includes('Get-ChildItem Env:') &&
      installerScript.includes('$name.StartsWith("CUDA")') &&
      installerScript.includes('$name.StartsWith("CT2_")') &&
      installerScript.includes('$name -eq "PATH"'),
    'Windows worker installer should preserve runtime env needed by CUDA/Python workers'
  )

  console.log('worker client proof passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
