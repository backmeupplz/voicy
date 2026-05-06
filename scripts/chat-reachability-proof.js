#!/usr/bin/env node

require('module-alias/register')
require('reflect-metadata')

const assert = require('assert')

function telegramError(error_code, description) {
  const error = new Error(description)
  error.error_code = error_code
  error.description = description
  return error
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

function provesTelegramReachabilityClassification() {
  const {
    TelegramReachabilityFailureKind,
    classifyTelegramReachabilityFailure,
  } = require('../dist/helpers/chatReachability')

  const permanentCases = [
    telegramError(
      400,
      'Bad Request: not enough rights to send text messages to the chat'
    ),
    telegramError(403, 'Forbidden: bot was kicked from the supergroup chat'),
    telegramError(400, 'Bad Request: chat not found'),
  ]

  for (const error of permanentCases) {
    assert.equal(
      classifyTelegramReachabilityFailure(error).kind,
      TelegramReachabilityFailureKind.permanent,
      error.description
    )
  }

  assert.equal(
    classifyTelegramReachabilityFailure(
      telegramError(400, 'Bad Request: message to edit not found')
    ).kind,
    TelegramReachabilityFailureKind.staleStatusMessage
  )
  assert.equal(
    classifyTelegramReachabilityFailure(
      telegramError(400, 'Bad Request: message is not modified')
    ).kind,
    TelegramReachabilityFailureKind.benign
  )
  assert.equal(
    classifyTelegramReachabilityFailure(
      telegramError(429, 'Too Many Requests: retry after 10')
    ).kind,
    TelegramReachabilityFailureKind.transient
  )
  assert.equal(
    classifyTelegramReachabilityFailure(
      telegramError(500, 'Internal Server Error')
    ).kind,
    TelegramReachabilityFailureKind.transient
  )
  const { chatCanQueueTranscriptions } = require('../dist/helpers/chatReachability')
  assert.equal(
    chatCanQueueTranscriptions({}),
    true,
    'legacy chat docs without reachability fields should default reachable'
  )
}

async function provesSendMessageFailureMarksChatUnreachable() {
  const botPath = require.resolve('../dist/helpers/bot')
  const chatPath = require.resolve('../dist/models/Chat')
  const voicePath = require.resolve('../dist/models/Voice')
  const helperPath = require.resolve('../dist/helpers/chatReachability')
  const publisherPath = require.resolve(
    '../dist/helpers/transcriptionJobs/publishCompletedTranscriptionJob'
  )
  const updates = []

  clearModule(helperPath)
  clearModule(publisherPath)
  mockModule(chatPath, {
    ChatModel: {
      findOneAndUpdate: async (...args) => {
        updates.push(args)
        return {}
      },
    },
  })
  mockModule(botPath, {
    __esModule: true,
    default: {
      api: {
        sendMessage: async () => {
          throw telegramError(
            400,
            'Bad Request: not enough rights to send text messages to the chat'
          )
        },
      },
    },
  })
  mockModule(voicePath, {
    VoiceModel: {
      findOneAndUpdate: async () => {
        throw new Error('voice record should not be stored after publish fails')
      },
    },
  })

  const publishCompletedTranscriptionJob = require(publisherPath).default

  await assert.rejects(
    () =>
      publishCompletedTranscriptionJob({
        sourceUrl: 'https://example.invalid/audio.ogg',
        chatId: 'chat-unreachable',
        telegramChatId: '123',
        telegramChatType: 'private',
        sourceMessageId: 10,
        fileId: 'file-1',
        sourceKind: 'voice',
        resultText: 'final transcript',
      }),
    /not enough rights/
  )

  assert.equal(updates.length, 1)
  assert.deepEqual(updates[0][0], { id: 'chat-unreachable' })
  assert.equal(updates[0][1].$set.botCanSendMessages, false)
  assert.equal(
    updates[0][1].$set.transcriptionDisabledUntilReachable,
    true
  )
  assert(
    updates[0][1].$set.transcriptionUnreachableReason.includes(
      'publishCompletedTranscriptionJob'
    )
  )
}

async function provesUnreachableChatSkipsFutureAudioQueueing() {
  const handlerPath = require.resolve('../dist/handlers/handleAudio')
  const transcriptionJobPath = require.resolve('../dist/models/TranscriptionJob')
  const createdJobs = []

  clearModule(handlerPath)
  mockModule(transcriptionJobPath, {
    TranscriptionJobSourceKind: {
      voice: 'voice',
      videoNote: 'video_note',
      audio: 'audio',
      document: 'document',
      video: 'video',
    },
    TranscriptionJobStatus: {
      queuedForDownload: 'queued_for_download',
      failed: 'failed',
    },
    TranscriptionJobModel: {
      create: async (...args) => {
        createdJobs.push(args)
        return { save: async () => undefined }
      },
    },
  })

  const handleAudio = require(handlerPath).default

  await handleAudio({
    dbchat: {
      id: 'chat-unreachable',
      botCanSendMessages: false,
      transcriptionDisabledUntilReachable: true,
      transcribeAllAudio: true,
      silent: false,
      uiLanguage: 'en',
    },
    chat: { id: 123, type: 'private' },
    msg: {
      message_id: 20,
      voice: {
        file_id: 'voice-file-id',
        file_unique_id: 'voice-unique-id',
        file_size: 1024,
      },
    },
    timeReceived: new Date(),
  })

  assert.equal(createdJobs.length, 0)
}

async function provesSuccessfulCommandResetClearsReachabilityBlock() {
  const { markChatReachable } = require('../dist/helpers/chatReachability')
  const saved = []
  const dbchat = {
    id: 'chat-reset',
    botCanSendMessages: false,
    transcriptionDisabledUntilReachable: true,
    transcriptionUnreachableReason: 'previous permission failure',
    save: async () => {
      saved.push({
        botCanSendMessages: dbchat.botCanSendMessages,
        transcriptionDisabledUntilReachable:
          dbchat.transcriptionDisabledUntilReachable,
        transcriptionReachableAt: dbchat.transcriptionReachableAt,
        transcriptionUnreachableReason: dbchat.transcriptionUnreachableReason,
      })
    },
  }

  await markChatReachable({ dbchat }, '/start')

  assert.equal(saved.length, 1)
  assert.equal(saved[0].botCanSendMessages, true)
  assert.equal(saved[0].transcriptionDisabledUntilReachable, false)
  assert(saved[0].transcriptionReachableAt instanceof Date)
  assert.equal(saved[0].transcriptionUnreachableReason, undefined)
}

async function main() {
  provesTelegramReachabilityClassification()
  await provesSendMessageFailureMarksChatUnreachable()
  await provesUnreachableChatSkipsFutureAudioQueueing()
  await provesSuccessfulCommandResetClearsReachabilityBlock()
  console.log('chat reachability proof passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
