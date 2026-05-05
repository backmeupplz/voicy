#!/usr/bin/env node

process.env.TOKEN = process.env.TOKEN || '000000:test-token'
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy'
process.env.VOICY_DISABLE_TELEGRAM_PUBLISH = '1'

require('reflect-metadata')
require('module-alias/register')

const http = require('http')
const mongoose = require('mongoose')
const os = require('os')
const path = require('path')
const { webhookApp } = require('../dist/helpers/startWebhook')
const { VoiceModel } = require('../dist/models/Voice')
const {
  TranscriptionJobModel,
  TranscriptionJobSourceKind,
  TranscriptionJobStatus,
} = require('../dist/models/TranscriptionJob')
const {
  WorkerClientModel,
  hashWorkerToken,
} = require('../dist/models/WorkerClient')
const {
  loadConfig,
  processNextJob,
} = require('../dist/workerClient/runWindowsWorker')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server))
  })
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

function createAudioServer() {
  return http.createServer((request, response) => {
    if (request.url !== '/sample.ogg') {
      response.writeHead(404)
      response.end()
      return
    }
    response.writeHead(200, { 'Content-Type': 'audio/ogg' })
    response.end(Buffer.from('sample audio bytes for worker e2e proof'))
  })
}

async function cleanup() {
  await Promise.all([
    WorkerClientModel.deleteMany({ name: /^e2e-/ }),
    TranscriptionJobModel.deleteMany({ chatId: 'e2e-chat' }),
    VoiceModel.deleteMany({ chatId: 'e2e-chat' }),
  ])
}

async function main() {
  if (!process.env.MONGO) {
    throw new Error('MONGO is required for the worker e2e proof')
  }

  await mongoose.connect(process.env.MONGO)
  await cleanup()

  const audioServer = await listen(createAudioServer())
  const apiServer = await listen(webhookApp)
  const token = 'e2e-worker-token'

  try {
    await WorkerClientModel.create({
      name: 'e2e-worker',
      tokenHash: hashWorkerToken(token),
    })
    const queuedJob = await TranscriptionJobModel.create({
      chatId: 'e2e-chat',
      telegramChatId: '123',
      sourceMessageId: 20,
      statusMessageId: 21,
      fileId: 'e2e-file',
      fileSize: 42,
      mimeType: 'audio/ogg',
      sourceKind: TranscriptionJobSourceKind.voice,
      sourceUrl: `http://127.0.0.1:${audioServer.address().port}/sample.ogg`,
      recognitionLanguageHint: 'en',
    })

    const config = loadConfig({
      VOICY_WORKER_API_URL: `http://127.0.0.1:${
        apiServer.address().port
      }/worker/v1`,
      VOICY_WORKER_TOKEN: token,
      VOICY_WORKER_TRANSCRIBE_EXECUTABLE: process.execPath,
      VOICY_WORKER_TRANSCRIBE_ARGS_JSON: JSON.stringify([
        'scripts/fake-transcriber.js',
        '{input}',
        '{output}',
        '{model}',
      ]),
      VOICY_WORKER_WORK_DIR: path.join(
        os.tmpdir(),
        `voicy-worker-e2e-${process.pid}`
      ),
      VOICY_WORKER_ENGINE: 'proof-engine',
      VOICY_WORKER_MODEL: 'proof-model',
    })

    const processed = await processNextJob(config, {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    })
    assert(processed, 'worker should process the queued job')

    const completedJob = await TranscriptionJobModel.findById(queuedJob._id)
    assert(
      completedJob.status === TranscriptionJobStatus.completed,
      'worker should complete the server job'
    )
    assert(
      completedJob.resultText === 'fake transcript from worker client proof',
      'worker should upload transcript text'
    )

    const voice = await VoiceModel.findOne({ chatId: 'e2e-chat' })
    assert(voice, 'publish path should create a completed Voice record')
    assert(
      voice.text === 'fake transcript from worker client proof',
      'Voice record should contain transcript text'
    )

    console.log('worker e2e proof passed')
  } finally {
    await close(apiServer)
    await close(audioServer)
    await cleanup()
    await mongoose.disconnect()
  }
}

main().catch(async (error) => {
  console.error(error)
  await mongoose.disconnect().catch(() => undefined)
  process.exitCode = 1
})
