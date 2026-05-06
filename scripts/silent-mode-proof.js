#!/usr/bin/env node

require('module-alias/register')

const assert = require('assert')

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

async function provesSilentProgressStartsWithTranscriptText() {
  const botPath = require.resolve('../dist/helpers/bot')
  const publisherPath = require.resolve(
    '../dist/helpers/transcriptionJobs/publishTranscriptionJobProgress'
  )
  const sendCalls = []
  const editCalls = []

  clearModule(publisherPath)
  mockModule(botPath, {
    __esModule: true,
    default: {
      api: {
        sendMessage: async (...args) => {
          sendCalls.push(args)
          return { message_id: 444 }
        },
        editMessageText: async (...args) => {
          editCalls.push(args)
        },
      },
    },
  })

  const publishTranscriptionJobProgress = require(publisherPath).default
  let saveCount = 0
  const job = {
    silent: true,
    telegramChatId: '123',
    telegramChatType: 'private',
    sourceMessageId: 10,
    uiLocale: 'en',
    partialResultText: 'first <chunk> & value',
    save: async () => {
      saveCount += 1
    },
  }

  assert.equal(await publishTranscriptionJobProgress(job, 'processing'), false)
  assert.equal(await publishTranscriptionJobProgress(job, 'failed'), false)
  assert.equal(await publishTranscriptionJobProgress(job, 'partial'), true)
  assert.equal(sendCalls.length, 1)
  assert.equal(editCalls.length, 0)
  assert.equal(sendCalls[0][0], '123')
  assert(sendCalls[0][1].startsWith('first '))
  assert(!sendCalls[0][1].includes('Turning into text'))
  assert(sendCalls[0][1].includes('&lt;chunk&gt; &amp; value'))
  assert.deepEqual(sendCalls[0][2], {
    parse_mode: 'HTML',
    reply_to_message_id: 10,
  })
  assert.equal(job.statusMessageId, 444)
  assert(job.lastProgressPublishedAt instanceof Date)
  assert.equal(saveCount, 1)

  job.partialResultText = 'second transcript chunk'
  job.lastProgressPublishedAt = new Date(Date.now() - 60_000)
  assert.equal(await publishTranscriptionJobProgress(job, 'partial'), true)
  assert.equal(sendCalls.length, 1)
  assert.equal(editCalls.length, 1)
  assert.deepEqual(editCalls[0], [
    '123',
    444,
    'second transcript chunk',
    { parse_mode: 'HTML' },
  ])
}

async function provesSilentCompletionSuppressesEmptyFallback() {
  const botPath = require.resolve('../dist/helpers/bot')
  const voicePath = require.resolve('../dist/models/Voice')
  const publisherPath = require.resolve(
    '../dist/helpers/transcriptionJobs/publishCompletedTranscriptionJob'
  )
  const sendCalls = []
  const deleteCalls = []
  const voiceUpserts = []

  clearModule(publisherPath)
  mockModule(botPath, {
    __esModule: true,
    default: {
      api: {
        deleteMessage: async (...args) => {
          deleteCalls.push(args)
        },
        editMessageText: async () => {
          throw new Error('unexpected edit')
        },
        sendMessage: async (...args) => {
          sendCalls.push(args)
        },
      },
    },
  })
  mockModule(voicePath, {
    VoiceModel: {
      findOneAndUpdate: async (...args) => {
        voiceUpserts.push(args)
      },
    },
  })

  const publishCompletedTranscriptionJob = require(publisherPath).default
  await publishCompletedTranscriptionJob({
    silent: true,
    chatId: 'chat-1',
    telegramChatId: '123',
    telegramChatType: 'private',
    sourceMessageId: 10,
    statusMessageId: 20,
    fileId: 'file-1',
    sourceKind: 'voice',
    resultText: '   ',
  })

  assert.equal(sendCalls.length, 0)
  assert.deepEqual(deleteCalls, [['123', 20]])
  assert.equal(voiceUpserts.length, 1)
  assert.equal(
    voiceUpserts[0][1].$set.text,
    '',
    'empty silent completions should still be stored for history'
  )
}

async function provesSilentCompletionSendsFinalTranscript() {
  const botPath = require.resolve('../dist/helpers/bot')
  const voicePath = require.resolve('../dist/models/Voice')
  const publisherPath = require.resolve(
    '../dist/helpers/transcriptionJobs/publishCompletedTranscriptionJob'
  )
  const sendCalls = []
  const voiceUpserts = []

  clearModule(publisherPath)
  mockModule(botPath, {
    __esModule: true,
    default: {
      api: {
        sendMessage: async (...args) => {
          sendCalls.push(args)
          return { message_id: 555 }
        },
      },
    },
  })
  mockModule(voicePath, {
    VoiceModel: {
      findOneAndUpdate: async (...args) => {
        voiceUpserts.push(args)
      },
    },
  })

  const publishCompletedTranscriptionJob = require(publisherPath).default
  await publishCompletedTranscriptionJob({
    silent: true,
    chatId: 'chat-1',
    telegramChatId: '123',
    telegramChatType: 'private',
    sourceMessageId: 10,
    fileId: 'file-1',
    sourceKind: 'voice',
    resultText: 'final transcript',
  })

  assert.equal(sendCalls.length, 1)
  assert.deepEqual(sendCalls[0], [
    '123',
    'final transcript',
    { reply_to_message_id: 10 },
  ])
  assert.equal(voiceUpserts.length, 1)
}

async function main() {
  await provesSilentProgressStartsWithTranscriptText()
  await provesSilentCompletionSuppressesEmptyFallback()
  await provesSilentCompletionSendsFinalTranscript()
  console.log('silent mode proof passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
