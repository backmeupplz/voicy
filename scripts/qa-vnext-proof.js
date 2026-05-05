#!/usr/bin/env node

process.env.TOKEN = process.env.TOKEN || '000000:test-token'
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy'
process.env.STRIPE_WEBHOOK_SIGNING_SECRET =
  process.env.STRIPE_WEBHOOK_SIGNING_SECRET || 'whsec_test'
process.env.VOICY_DISABLE_TELEGRAM_PUBLISH = '1'

require('reflect-metadata')
require('module-alias/register')

const fs = require('fs/promises')
const http = require('http')
const https = require('https')
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

const SAMPLE_AUDIO_URL =
  'https://raw.githubusercontent.com/Jakobovski/free-spoken-digit-dataset/master/recordings/0_jackson_0.wav'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function fetchBuffer(url) {
  const client = url.startsWith('https:') ? https : http
  return new Promise((resolve, reject) => {
    client
      .get(url, (response) => {
        if (
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          response.resume()
          fetchBuffer(new URL(response.headers.location, url).toString())
            .then(resolve)
            .catch(reject)
          return
        }

        if (response.statusCode !== 200) {
          response.resume()
          reject(
            new Error(`sample download failed with ${response.statusCode}`)
          )
          return
        }

        const chunks = []
        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
        response.on('end', () => resolve(Buffer.concat(chunks)))
      })
      .on('error', reject)
  })
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

function createAudioServer(sampleAudio) {
  let downloads = 0
  const server = http.createServer((request, response) => {
    if (request.url !== '/sample-voice.wav') {
      response.writeHead(404)
      response.end()
      return
    }
    downloads += 1
    response.writeHead(200, {
      'Content-Type': 'audio/wav',
      'Content-Length': sampleAudio.length,
    })
    response.end(sampleAudio)
  })
  return { server, downloads: () => downloads }
}

async function cleanup() {
  await Promise.all([
    WorkerClientModel.deleteMany({ name: /^qa-vnext-/ }),
    TranscriptionJobModel.deleteMany({ chatId: 'qa-vnext-chat' }),
    VoiceModel.deleteMany({ chatId: 'qa-vnext-chat' }),
  ])
}

async function main() {
  if (!process.env.MONGO) {
    throw new Error('MONGO is required for the vNext QA proof')
  }

  const sampleAudio = await fetchBuffer(SAMPLE_AUDIO_URL)
  assert(sampleAudio.length > 1000, 'downloaded sample audio is too small')
  assert(
    sampleAudio.subarray(0, 4).toString('ascii') === 'RIFF',
    'sample audio should be a WAV/RIFF file'
  )

  const samplePath = path.join(
    os.tmpdir(),
    `voicy-vnext-sample-${process.pid}.wav`
  )
  await fs.writeFile(samplePath, sampleAudio)

  await mongoose.connect(process.env.MONGO)
  await cleanup()

  const audioProof = createAudioServer(sampleAudio)
  const audioServer = await listen(audioProof.server)
  const apiServer = await listen(webhookApp)
  const token = 'qa-vnext-worker-token'

  try {
    await WorkerClientModel.create({
      name: 'qa-vnext-worker',
      tokenHash: hashWorkerToken(token),
    })
    const queuedJob = await TranscriptionJobModel.create({
      chatId: 'qa-vnext-chat',
      telegramChatId: '123',
      sourceMessageId: 100,
      statusMessageId: 101,
      fileId: 'qa-vnext-file',
      fileSize: sampleAudio.length,
      mimeType: 'audio/wav',
      sourceKind: TranscriptionJobSourceKind.voice,
      sourceUrl: `http://127.0.0.1:${
        audioServer.address().port
      }/sample-voice.wav`,
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
        `voicy-vnext-qa-${process.pid}`
      ),
      VOICY_WORKER_ENGINE: 'proof-engine',
      VOICY_WORKER_MODEL: 'proof-model',
    })

    const processed = await processNextJob(config, {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    })
    assert(processed, 'worker should process the queued sample voice job')
    assert(
      audioProof.downloads() === 1,
      'worker should download sample audio once'
    )

    const completedJob = await TranscriptionJobModel.findById(queuedJob._id)
    assert(
      completedJob.status === TranscriptionJobStatus.completed,
      'sample voice job should complete'
    )
    assert(
      completedJob.resultText === 'fake transcript from worker client proof',
      'sample voice job should store transcript text'
    )

    const voice = await VoiceModel.findOne({ chatId: 'qa-vnext-chat' })
    assert(voice, 'sample voice job should create a Voice record')
    assert(
      voice.sourceType === 'voice',
      'Voice record should preserve source type'
    )
    assert(
      voice.mimeType === 'audio/wav',
      'Voice record should preserve MIME type'
    )

    console.log(`vNext QA proof passed with sample ${SAMPLE_AUDIO_URL}`)
    console.log(`downloaded sample bytes: ${sampleAudio.length}`)
    console.log(`local sample copy: ${samplePath}`)
  } finally {
    await close(apiServer)
    await close(audioServer)
    await cleanup()
    await mongoose.disconnect()
    await fs.rm(samplePath, { force: true })
  }
}

main().catch(async (error) => {
  console.error(error)
  await mongoose.disconnect().catch(() => undefined)
  process.exitCode = 1
})
