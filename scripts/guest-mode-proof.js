require('module-alias/register')
require('reflect-metadata')
const assert = require('assert')

async function main() {
  const botCalls = []
  const botPath = require.resolve('@/helpers/bot')
  require.cache[botPath] = {
    id: botPath,
    filename: botPath,
    loaded: true,
    exports: {
      __esModule: true,
      default: {
        api: {
          editMessageTextInline: async (...args) => {
            botCalls.push(['editMessageTextInline', ...args])
            return true
          },
          sendMessage: async () => {
            throw new Error('guest proof must not send normal chat messages')
          },
          deleteMessage: async () => {
            throw new Error('guest proof must not delete normal chat messages')
          },
        },
      },
    },
  }

  const queued = []
  const handleAudioPath = require.resolve('@/handlers/handleAudio')
  require.cache[handleAudioPath] = {
    id: handleAudioPath,
    filename: handleAudioPath,
    loaded: true,
    exports: {
      __esModule: true,
      enqueueTranscription: async (...args) => {
        queued.push(args)
        return { id: 'queued-job' }
      },
    },
  }

  const { ChatModel } = require('@/models/Chat')
  ChatModel.findOrCreate = async ({ id }) => ({
    doc: {
      id,
      uiLanguage: 'en',
      silent: false,
      transcribeAllAudio: false,
      botCanSendMessages: true,
      transcriptionDisabledUntilReachable: false,
      paid: true,
    },
  })

  const { VoiceModel } = require('@/models/Voice')
  const voiceWrites = []
  VoiceModel.findOneAndUpdate = async (...args) => {
    voiceWrites.push(args)
    return undefined
  }

  const allowedUpdates = require('@/helpers/telegramAllowedUpdates').default
  assert(
    allowedUpdates.includes('guest_message'),
    'allowed_updates must include guest_message'
  )

  const {
    answerGuestQueryWithText,
    guestChatRecordId,
  } = require('@/helpers/telegramGuestMode')
  assert.equal(
    guestChatRecordId({ chat: { id: -100123, type: 'supergroup' } }),
    'guest:-100123'
  )

  const answerCalls = []
  const ctx = {
    api: {
      raw: {
        answerGuestQuery: async (payload) => {
          answerCalls.push(payload)
          return { inline_message_id: 'inline-answer-1' }
        },
      },
    },
  }
  const inlineMessageId = await answerGuestQueryWithText(
    ctx,
    'guest/query:1',
    '<b>Turning into text...</b>',
    { parse_mode: 'HTML' }
  )
  assert.equal(inlineMessageId, 'inline-answer-1')
  assert.deepEqual(answerCalls[0], {
    guest_query_id: 'guest/query:1',
    result: {
      type: 'article',
      id: 'guestquery1',
      title: 'Voicy',
      input_message_content: {
        message_text: '<b>Turning into text...</b>',
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      },
    },
  })

  const handleGuestMessage = require('@/handlers/handleGuestMessage').default
  const guestUpdateCtx = {
    update: {
      guest_message: {
        message_id: 20,
        date: Math.floor(Date.now() / 1000),
        chat: { id: -100123, type: 'supergroup' },
        from: { id: 101, is_bot: false, first_name: 'Ada' },
        guest_query_id: 'guest-query-queue',
        reply_to_message: {
          message_id: 19,
          date: Math.floor(Date.now() / 1000),
          chat: { id: -100123, type: 'supergroup' },
          from: { id: 202, is_bot: false, first_name: 'Grace' },
          voice: {
            file_id: 'voice-file-id',
            file_unique_id: 'voice-unique-id',
            file_size: 12345,
          },
        },
      },
    },
    api: ctx.api,
    timeReceived: new Date(),
  }

  let nextCalled = false
  await handleGuestMessage(guestUpdateCtx, async () => {
    nextCalled = true
  })
  assert.equal(
    nextCalled,
    false,
    'guest updates must not continue to normal flow'
  )
  assert.equal(queued.length, 1)
  assert.equal(queued[0][0].dbchat.id, 'guest:-100123')
  assert.equal(queued[0][1], 'voice-file-id')
  assert.equal(queued[0][2].message_id, 19)
  assert.deepEqual(queued[0][4], { guestQueryId: 'guest-query-queue' })

  delete require.cache[handleAudioPath]
  const activeJobUpdates = []
  const transcriptionJobPath = require.resolve('@/models/TranscriptionJob')
  require.cache[transcriptionJobPath] = {
    id: transcriptionJobPath,
    filename: transcriptionJobPath,
    loaded: true,
    exports: {
      TranscriptionJobStatus: {
        queuedForDownload: 'queued_for_download',
        downloading: 'downloading',
        ready: 'ready',
        transcribing: 'transcribing',
        queued: 'queued',
        processing: 'processing',
        completed: 'completed',
        failed: 'failed',
      },
      activeTranscriptionJobStatuses: ['processing'],
      TranscriptionJobModel: {
        findOne: async () => ({
          _id: 'active-job-1',
          guestInlineMessageId: 'guest-inline-original',
          guestInlineMessageIds: ['guest-inline-original'],
        }),
        updateOne: async (...args) => {
          activeJobUpdates.push(args)
          return { modifiedCount: 1 }
        },
      },
    },
  }
  const abuseLimitsPath = require.resolve(
    '@/helpers/transcriptionJobs/abuseLimits'
  )
  require.cache[abuseLimitsPath] = {
    id: abuseLimitsPath,
    filename: abuseLimitsPath,
    loaded: true,
    exports: {
      TranscriptionAbuseLimitReason: {},
      checkTranscriptionAbuseLimits: async () => undefined,
    },
  }
  const goldenAccessPath = require.resolve(
    '@/helpers/goldenBorodutchFreeTranscriptions'
  )
  require.cache[goldenAccessPath] = {
    id: goldenAccessPath,
    filename: goldenAccessPath,
    loaded: true,
    exports: {
      TranscriptionAccessDenialReason: {},
      checkTranscriptionAccess: async () => ({ allowed: true }),
      refundGoldenBorodutchFreeTranscription: async () => undefined,
    },
  }
  const cachePath = require.resolve(
    '@/helpers/transcriptionJobs/transcriptionResultCache'
  )
  require.cache[cachePath] = {
    id: cachePath,
    filename: cachePath,
    loaded: true,
    exports: {
      publishCachedTranscriptionResult: async () => false,
      sourceKindFromTelegramSourceType: () => 'voice',
      transcriptionResultCacheKey: () => 'voice-cache-key',
    },
  }
  const { enqueueTranscription: actualEnqueueTranscription } =
    require('@/handlers/handleAudio')
  const dedupeAnswerCalls = []
  const dedupeCtx = {
    dbchat: {
      id: 'guest:-100123',
      uiLanguage: 'en',
      silent: false,
      paid: true,
      botCanSendMessages: true,
      transcriptionDisabledUntilReachable: false,
    },
    chat: { id: -100123, type: 'supergroup' },
    from: { id: 101, is_bot: false, first_name: 'Ada' },
    msg: { message_id: 20 },
    api: {
      raw: {
        answerGuestQuery: async (payload) => {
          dedupeAnswerCalls.push(payload)
          return { inline_message_id: 'guest-inline-dedupe' }
        },
      },
    },
    timeReceived: new Date(),
  }
  const dedupeSourceMessage = {
    message_id: 19,
    date: Math.floor(Date.now() / 1000),
    chat: { id: -100123, type: 'supergroup' },
    from: { id: 202, is_bot: false, first_name: 'Grace' },
    voice: {
      file_id: 'voice-file-id',
      file_unique_id: 'voice-unique-id',
      file_size: 12345,
    },
  }
  await actualEnqueueTranscription(
    dedupeCtx,
    'voice-file-id',
    dedupeSourceMessage,
    undefined,
    { guestQueryId: 'guest-query-dedupe' }
  )
  assert.equal(dedupeAnswerCalls.length, 1)
  assert.deepEqual(activeJobUpdates[0], [
    { _id: 'active-job-1' },
    { $addToSet: { guestInlineMessageIds: 'guest-inline-dedupe' } },
  ])

  await handleGuestMessage(
    {
      update: {
        guest_message: {
          message_id: 21,
          date: Math.floor(Date.now() / 1000),
          chat: { id: -100124, type: 'supergroup' },
          from: { id: 101, is_bot: false, first_name: 'Ada' },
          guest_query_id: 'guest-query-empty',
          reply_to_message: {
            message_id: 18,
            date: Math.floor(Date.now() / 1000),
            chat: { id: -100124, type: 'supergroup' },
            text: 'not media',
          },
        },
      },
      api: ctx.api,
      timeReceived: new Date(),
    },
    async () => {}
  )
  const unsupportedGuestReply = answerCalls.find(
    (call) => call.guest_query_id === 'guest-query-empty'
  )
  assert(
    unsupportedGuestReply.result.input_message_content.message_text.includes(
      'Reply to a voice message'
    ),
    'unsupported guest updates should get a concise media instruction'
  )

  const publishProgress =
    require('@/helpers/transcriptionJobs/publishTranscriptionJobProgress').default
  const publishCompleted =
    require('@/helpers/transcriptionJobs/publishCompletedTranscriptionJob').default
  const job = {
    chatId: 'guest:-100123',
    telegramChatId: '-100123',
    telegramChatType: 'supergroup',
    sourceMessageId: 19,
    guestInlineMessageId: 'guest-inline-1',
    guestInlineMessageIds: ['guest-inline-1', 'guest-inline-2'],
    uiLocale: 'en',
    resultText: 'hello from guest mode',
    silent: false,
    fileId: 'voice-file-id',
    sourceKind: 'voice',
    save: async () => undefined,
  }
  assert.equal(await publishProgress(job, 'processing', { force: true }), true)
  await publishCompleted(job)
  assert.equal(botCalls[0][0], 'editMessageTextInline')
  assert.equal(botCalls[0][1], 'guest-inline-1')
  assert(botCalls[0][2].includes('Turning into text...'))
  assert.deepEqual(botCalls[0][3], { parse_mode: 'HTML' })
  assert.deepEqual(botCalls[1], [
    'editMessageTextInline',
    'guest-inline-2',
    botCalls[0][2],
    { parse_mode: 'HTML' },
  ])
  assert.deepEqual(botCalls[2], [
    'editMessageTextInline',
    'guest-inline-1',
    'hello from guest mode',
  ])
  assert.deepEqual(botCalls[3], [
    'editMessageTextInline',
    'guest-inline-2',
    'hello from guest mode',
  ])
  assert.equal(voiceWrites.length, 1)

  console.log('Guest Mode proof passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
