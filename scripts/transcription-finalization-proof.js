#!/usr/bin/env node

require('module-alias/register')
require('reflect-metadata')

const assert = require('assert')

const TRANSCRIPTION_STATUSES = {
  queuedForDownload: 'queued_for_download',
  downloading: 'downloading',
  ready: 'ready',
  transcribing: 'transcribing',
  queued: 'queued',
  processing: 'processing',
  completed: 'completed',
  failed: 'failed',
}

function mockModule(path, exports) {
  require.cache[path] = {
    id: path,
    filename: path,
    loaded: true,
    exports,
  }
}

function clearModule(path) {
  delete require.cache[path]
}

async function provesCompletedPublisherFallsBackToFinalMessage() {
  const botPath = require.resolve('../dist/helpers/bot')
  const voicePath = require.resolve('../dist/models/Voice')
  const publisherPath = require.resolve(
    '../dist/helpers/transcriptionJobs/publishCompletedTranscriptionJob'
  )
  const editCalls = []
  const deleteCalls = []
  const sendCalls = []
  const voiceUpserts = []

  clearModule(publisherPath)
  mockModule(botPath, {
    __esModule: true,
    default: {
      api: {
        editMessageText: async (...args) => {
          editCalls.push(args)
          throw new Error('simulated Telegram edit failure')
        },
        deleteMessage: async (...args) => {
          deleteCalls.push(args)
        },
        sendMessage: async (...args) => {
          sendCalls.push(args)
          return { message_id: 999 }
        },
      },
    },
  })
  mockModule(voicePath, {
    VoiceModel: {
      findOneAndUpdate: async (...args) => {
        voiceUpserts.push(args)
        return {}
      },
    },
  })

  const publishCompletedTranscriptionJob = require(publisherPath).default

  await publishCompletedTranscriptionJob({
    sourceUrl: 'https://example.invalid/audio.ogg',
    chatId: 'chat-1',
    telegramChatId: '123',
    telegramChatType: 'private',
    sourceMessageId: 10,
    statusMessageId: 20,
    fileId: 'file-1',
    sourceKind: 'voice',
    resultText: 'final transcript',
  })

  assert.equal(editCalls.length, 1, 'status message should be edited first')
  assert.equal(
    deleteCalls.length,
    1,
    'failed edit should trigger stale draft deletion'
  )
  assert.equal(sendCalls.length, 1, 'failed edit should send final fallback')
  assert.equal(sendCalls[0][1], 'final transcript')
  assert(
    !sendCalls[0][1].includes('Turning into text') &&
      !sendCalls[0][1].includes('Draft text'),
    'fallback final message must not include draft/progress copy'
  )
  assert.equal(
    voiceUpserts.length,
    1,
    'completed voice record should be stored after publish recovery'
  )
  assert.deepEqual(voiceUpserts[0][0], {
    chatId: 'chat-1',
    messageId: 10,
  })
  assert.equal(voiceUpserts[0][2].upsert, true)
}

async function provesCompletionWaitsForPublish() {
  const jobServicePath = require.resolve('../dist/helpers/workerApi/jobService')
  const transcriptionJobPath = require.resolve('../dist/models/TranscriptionJob')
  const publisherPath = require.resolve(
    '../dist/helpers/transcriptionJobs/publishCompletedTranscriptionJob'
  )
  const jobId = '507f1f77bcf86cd799439011'
  const updates = []
  const workerClient = { _id: { toString: () => 'worker-1' } }

  clearModule(jobServicePath)
  mockModule(transcriptionJobPath, {
    TranscriptionJobStatus: TRANSCRIPTION_STATUSES,
    TranscriptionJobModel: {
      findOneAndUpdate: async (...args) => {
        updates.push(args)
        if (updates.length === 1) {
          return {
            _id: { toString: () => jobId },
            status: TRANSCRIPTION_STATUSES.transcribing,
            workerId: 'worker-1',
            chatId: 'chat-1',
            telegramChatId: '123',
            telegramChatType: 'private',
            sourceMessageId: 10,
            statusMessageId: 20,
            fileId: 'file-1',
            sourceKind: 'voice',
            resultText: 'final transcript',
          }
        }
        return {
          _id: { toString: () => jobId },
          status: TRANSCRIPTION_STATUSES.completed,
        }
      },
    },
  })
  mockModule(publisherPath, {
    __esModule: true,
    default: async () => undefined,
  })

  const { completeJob } = require(jobServicePath)
  const job = await completeJob(jobId, workerClient, {
    text: 'final transcript',
  })

  assert.equal(job.status, TRANSCRIPTION_STATUSES.completed)
  assert.equal(
    updates[0][1].$set.status,
    undefined,
    'result persistence must not mark the job completed before publishing'
  )
  assert.equal(
    updates[1][1].$set.status,
    TRANSCRIPTION_STATUSES.completed,
    'job should be completed only after final publish succeeds'
  )
}

async function provesPublishFailureLeavesJobRetryable() {
  const jobServicePath = require.resolve('../dist/helpers/workerApi/jobService')
  const transcriptionJobPath = require.resolve('../dist/models/TranscriptionJob')
  const publisherPath = require.resolve(
    '../dist/helpers/transcriptionJobs/publishCompletedTranscriptionJob'
  )
  const jobId = '507f1f77bcf86cd799439012'
  const updates = []
  const workerClient = { _id: { toString: () => 'worker-1' } }
  const originalConsoleError = console.error

  clearModule(jobServicePath)
  mockModule(transcriptionJobPath, {
    TranscriptionJobStatus: TRANSCRIPTION_STATUSES,
    TranscriptionJobModel: {
      findOneAndUpdate: async (...args) => {
        updates.push(args)
        return {
          _id: { toString: () => jobId },
          status: TRANSCRIPTION_STATUSES.transcribing,
          workerId: 'worker-1',
          chatId: 'chat-1',
          telegramChatId: '123',
          telegramChatType: 'private',
          sourceMessageId: 10,
          statusMessageId: 20,
          fileId: 'file-1',
          sourceKind: 'voice',
          resultText: 'final transcript',
        }
      },
    },
  })
  mockModule(publisherPath, {
    __esModule: true,
    default: async () => {
      throw new Error('publish failed')
    },
  })

  const { completeJob } = require(jobServicePath)
  try {
    console.error = () => undefined
    await assert.rejects(
      () => completeJob(jobId, workerClient, { text: 'final transcript' }),
      /publish failed/
    )
  } finally {
    console.error = originalConsoleError
  }

  assert.equal(updates.length, 1)
  assert.equal(
    updates[0][1].$set.status,
    undefined,
    'publish failure must not convert an in-progress job into completed'
  )
}

async function main() {
  await provesCompletedPublisherFallsBackToFinalMessage()
  await provesCompletionWaitsForPublish()
  await provesPublishFailureLeavesJobRetryable()
  console.log('transcription finalization proof passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
