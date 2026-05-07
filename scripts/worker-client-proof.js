#!/usr/bin/env node

const http = require('http')
const os = require('os')
const path = require('path')

const {
  loadConfig,
  processAvailableJobs,
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
    downloaded: false,
    transcribing: false,
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
        JSON.stringify({ ok: true, result: { file_path: 'audio/proof.ogg' } })
      )
      return
    }

    if (
      request.method === 'GET' &&
      url.pathname === '/file/botproof-telegram-token/audio/proof.ogg'
    ) {
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

  console.log('worker client proof passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
