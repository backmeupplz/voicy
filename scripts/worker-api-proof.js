#!/usr/bin/env node

process.env.TOKEN = process.env.TOKEN || '000000:test-token'
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy'
process.env.STRIPE_WEBHOOK_SIGNING_SECRET =
  process.env.STRIPE_WEBHOOK_SIGNING_SECRET || 'whsec_test'
process.env.VOICY_DISABLE_TELEGRAM_PUBLISH = '1'

require('reflect-metadata')
require('module-alias/register')

const mongoose = require('mongoose')
const { webhookApp } = require('../dist/helpers/startWebhook')
const {
  WorkerClientModel,
  hashWorkerToken,
} = require('../dist/models/WorkerClient')
const {
  TranscriptionJobModel,
  TranscriptionJobSourceKind,
  TranscriptionJobStatus,
} = require('../dist/models/TranscriptionJob')
const { VoiceModel } = require('../dist/models/Voice')

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

async function request(baseUrl, path, token, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: token ? `Bearer ${token}` : undefined,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
}

async function main() {
  if (!process.env.MONGO) {
    throw new Error('MONGO is required for the worker API proof')
  }

  await mongoose.connect(process.env.MONGO)
  await Promise.all([
    WorkerClientModel.deleteMany({ name: /^proof-/ }),
    TranscriptionJobModel.deleteMany({ chatId: 'proof-chat' }),
    VoiceModel.deleteMany({ fileId: /^proof-file/ }),
  ])

  const tokenA = 'proof-token-a'
  const tokenB = 'proof-token-b'
  await WorkerClientModel.create([
    { name: 'proof-a', tokenHash: hashWorkerToken(tokenA) },
    { name: 'proof-b', tokenHash: hashWorkerToken(tokenB) },
  ])
  const queuedJob = await TranscriptionJobModel.create({
    chatId: 'proof-chat',
    telegramChatId: '123',
    sourceMessageId: 10,
    fileId: 'proof-file-1',
    sourceKind: TranscriptionJobSourceKind.voice,
    sourceUrl: 'https://example.invalid/proof.ogg',
  })

  const server = await listen(webhookApp)
  const baseUrl = `http://127.0.0.1:${server.address().port}/worker/v1`

  try {
    const unauthenticated = await request(
      baseUrl,
      '/jobs/claim-download',
      undefined,
      { method: 'POST' }
    )
    assert(unauthenticated.status === 401, 'unauthenticated claim should fail')

    const [claimA, claimB] = await Promise.all([
      request(baseUrl, '/jobs/claim-download', tokenA, { method: 'POST' }),
      request(baseUrl, '/jobs/claim-download', tokenB, { method: 'POST' }),
    ])
    const claimStatuses = [claimA.status, claimB.status].sort().join(',')
    assert(
      claimStatuses === '200,204',
      `only one worker should claim the queued job, got ${claimStatuses}`
    )

    const claimedResponse = claimA.status === 200 ? claimA : claimB
    const claimedToken = claimA.status === 200 ? tokenA : tokenB
    const otherToken = claimA.status === 200 ? tokenB : tokenA
    const { job } = await claimedResponse.json()
    assert(job.id === queuedJob._id.toString(), 'claimed unexpected job')
    assert(
      job.status === TranscriptionJobStatus.downloading,
      'job not downloading'
    )

    const source = await request(
      baseUrl,
      `/jobs/${job.id}/source`,
      claimedToken
    )
    assert(source.status === 200, 'owning worker should read job source')
    const sourceBody = await source.json()
    assert(
      sourceBody.source.sourceUrl === 'https://example.invalid/proof.ogg',
      'safe legacy sourceUrl should remain available'
    )

    const tokenUrlJob = await TranscriptionJobModel.create({
      chatId: 'proof-chat',
      telegramChatId: '123',
      sourceMessageId: 12,
      fileId: 'proof-file-token-url',
      sourceKind: TranscriptionJobSourceKind.voice,
      sourceUrl: `https://api.telegram.org/file/bot${process.env.TOKEN}/voice/proof.ogg`,
    })
    const tokenUrlClaim = await request(
      baseUrl,
      '/jobs/claim-download',
      claimedToken,
      { method: 'POST' }
    )
    assert(tokenUrlClaim.status === 200, 'token URL job should be claimable')
    const tokenUrlClaimBody = await tokenUrlClaim.json()
    assert(
      tokenUrlClaimBody.job.id === tokenUrlJob._id.toString(),
      'claimed wrong token URL job'
    )
    assert(
      !tokenUrlClaimBody.job.sourceUrl,
      'token-bearing sourceUrl should be redacted from job payload'
    )
    const tokenUrlSource = await request(
      baseUrl,
      `/jobs/${tokenUrlClaimBody.job.id}/source`,
      claimedToken
    )
    assert(tokenUrlSource.status === 200, 'worker should read token URL source')
    const tokenUrlSourceBody = await tokenUrlSource.json()
    assert(
      !tokenUrlSourceBody.source.sourceUrl,
      'token-bearing sourceUrl should be redacted from source payload'
    )
    await TranscriptionJobModel.deleteOne({ _id: tokenUrlJob._id })

    const stolenHeartbeat = await request(
      baseUrl,
      `/jobs/${job.id}/heartbeat`,
      otherToken,
      { method: 'POST' }
    )
    assert(stolenHeartbeat.status === 404, 'other worker should not heartbeat')

    const downloaded = await request(
      baseUrl,
      `/jobs/${job.id}/downloaded`,
      claimedToken,
      {
        method: 'POST',
        body: JSON.stringify({ localSourcePath: '/tmp/proof-file-1.ogg' }),
      }
    )
    assert(downloaded.status === 200, 'owning worker should mark downloaded')
    const readyJob = await TranscriptionJobModel.findById(job.id)
    assert(
      readyJob.status === TranscriptionJobStatus.ready,
      'downloaded job should become ready'
    )

    const transcribe = await request(
      baseUrl,
      `/jobs/${job.id}/transcribe`,
      claimedToken,
      { method: 'POST' }
    )
    assert(
      transcribe.status === 200,
      'owning worker should start transcription'
    )

    const progress = await request(
      baseUrl,
      `/jobs/${job.id}/progress`,
      claimedToken,
      {
        method: 'POST',
        body: JSON.stringify({
          text: 'proof partial transcript',
          parts: [{ timeCode: '00:00', text: 'proof partial transcript' }],
          language: 'en',
          engine: 'proof-engine',
          duration: 0.6,
        }),
      }
    )
    assert(progress.status === 200, 'owning worker should submit progress')
    const progressedJob = await TranscriptionJobModel.findById(job.id)
    assert(
      progressedJob.partialResultText === 'proof partial transcript',
      'progress text missing'
    )
    assert(progressedJob.lastProgressAt, 'progress timestamp missing')

    const result = await request(
      baseUrl,
      `/jobs/${job.id}/result`,
      claimedToken,
      {
        method: 'POST',
        body: JSON.stringify({
          text: 'proof transcript',
          parts: [{ timeCode: '00:00', text: 'proof transcript' }],
          language: 'en',
          engine: 'proof-engine',
          duration: 1.2,
        }),
      }
    )
    assert(result.status === 200, 'owning worker should submit result')
    const completedJob = await TranscriptionJobModel.findById(job.id)
    assert(
      completedJob.status === TranscriptionJobStatus.completed,
      'result upload should complete job'
    )
    assert(
      completedJob.resultText === 'proof transcript',
      'result text missing'
    )

    const emptyJob = await TranscriptionJobModel.create({
      chatId: 'proof-chat',
      telegramChatId: '123',
      sourceMessageId: 13,
      fileId: 'proof-file-empty',
      sourceKind: TranscriptionJobSourceKind.voice,
      sourceUrl: 'https://example.invalid/empty.ogg',
    })
    const claimEmpty = await request(baseUrl, '/jobs/claim-download', tokenA, {
      method: 'POST',
    })
    assert(claimEmpty.status === 200, 'empty job should be claimable')
    const emptyClaim = await claimEmpty.json()
    assert(emptyClaim.job.id === emptyJob._id.toString(), 'claimed wrong empty job')
    const emptyDownloaded = await request(
      baseUrl,
      `/jobs/${emptyClaim.job.id}/downloaded`,
      tokenA,
      {
        method: 'POST',
        body: JSON.stringify({ localSourcePath: '/tmp/proof-empty.ogg' }),
      }
    )
    assert(emptyDownloaded.status === 200, 'empty job should mark downloaded')
    const emptyTranscribe = await request(
      baseUrl,
      `/jobs/${emptyClaim.job.id}/transcribe`,
      tokenA,
      { method: 'POST' }
    )
    assert(emptyTranscribe.status === 200, 'empty job should start transcription')
    const emptyResult = await request(
      baseUrl,
      `/jobs/${emptyClaim.job.id}/result`,
      tokenA,
      {
        method: 'POST',
        body: JSON.stringify({
          text: '',
          parts: [],
          language: 'en',
          engine: 'proof-engine',
          duration: 0,
        }),
      }
    )
    assert(emptyResult.status === 200, 'empty result should be accepted')
    const completedEmptyJob = await TranscriptionJobModel.findById(
      emptyClaim.job.id
    )
    assert(
      completedEmptyJob.status === TranscriptionJobStatus.completed,
      'empty result should complete job'
    )
    assert(completedEmptyJob.resultText === '', 'empty result text should persist')

    const retryJob = await TranscriptionJobModel.create({
      chatId: 'proof-chat',
      telegramChatId: '123',
      sourceMessageId: 11,
      fileId: 'proof-file-2',
      sourceKind: TranscriptionJobSourceKind.voice,
      sourceUrl: 'https://example.invalid/proof-2.ogg',
    })
    const claimRetry = await request(baseUrl, '/jobs/claim-download', tokenA, {
      method: 'POST',
    })
    assert(claimRetry.status === 200, 'second job should be claimable')
    const retryClaim = await claimRetry.json()
    assert(
      retryClaim.job.id === retryJob._id.toString(),
      'claimed wrong retry job'
    )
    const failure = await request(
      baseUrl,
      `/jobs/${retryClaim.job.id}/failure`,
      tokenA,
      {
        method: 'POST',
        body: JSON.stringify({ error: 'temporary', retryable: true }),
      }
    )
    assert(failure.status === 200, 'retryable failure should be accepted')
    const requeuedJob = await TranscriptionJobModel.findById(retryClaim.job.id)
    assert(
      requeuedJob.status === TranscriptionJobStatus.queuedForDownload,
      'retryable failure should requeue below max attempts'
    )

    console.log('worker API proof passed')
  } finally {
    await close(server)
    await Promise.all([
      WorkerClientModel.deleteMany({ name: /^proof-/ }),
      TranscriptionJobModel.deleteMany({ chatId: 'proof-chat' }),
      VoiceModel.deleteMany({ fileId: /^proof-file/ }),
    ])
    await mongoose.disconnect()
  }
}

main().catch(async (error) => {
  console.error(error)
  await mongoose.disconnect().catch(() => undefined)
  process.exit(1)
})
