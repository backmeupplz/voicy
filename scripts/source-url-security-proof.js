#!/usr/bin/env node

process.env.TOKEN = process.env.TOKEN || '123456:proof-token-secret'
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy'
process.env.VOICY_DISABLE_TELEGRAM_PUBLISH = '1'

require('reflect-metadata')
require('module-alias/register')

const mongoose = require('mongoose')
const { enqueueTranscription } = require('../dist/handlers/handleAudio')
const {
  safeWorkerSourceUrl,
} = require('../dist/helpers/sourceUrlSecurity')
const {
  scrubTokenBearingSourceUrls,
} = require('../dist/helpers/sourceUrlScrubber')
const { VoiceModel } = require('../dist/models/Voice')
const {
  TranscriptionJobModel,
  TranscriptionJobSourceKind,
  TranscriptionJobStatus,
} = require('../dist/models/TranscriptionJob')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function tokenFileUrl(path) {
  return `https://api.telegram.org/file/bot${process.env.TOKEN}/${path}`
}

async function cleanup() {
  await Promise.all([
    TranscriptionJobModel.deleteMany({ chatId: 'source-url-proof-chat' }),
    VoiceModel.deleteMany({ chatId: 'source-url-proof-chat' }),
  ])
}

async function main() {
  if (!process.env.MONGO) {
    throw new Error('MONGO is required for the source URL security proof')
  }

  await mongoose.connect(process.env.MONGO)
  await cleanup()

  const ctx = {
    dbchat: {
      id: 'source-url-proof-chat',
      paid: true,
      transcribeAllAudio: true,
      uiLanguage: 'en',
    },
    chat: { id: 123, type: 'channel' },
    from: { id: 456 },
    msg: {
      message_id: 789,
      voice: {
        file_id: 'proof-file-id',
        file_unique_id: 'proof-file-unique-id',
        file_size: 4096,
      },
    },
    timeReceived: new Date(),
  }

  try {
    const queuedJob = await enqueueTranscription(
      ctx,
      'proof-file-id',
      ctx.msg
    )
    assert(!queuedJob.sourceUrl, 'new queued job should not store sourceUrl')
    assert(queuedJob.fileId === 'proof-file-id', 'new queued job stores fileId')
    assert(
      queuedJob.fileUniqueId === 'proof-file-unique-id',
      'new queued job stores fileUniqueId'
    )

    const dirtyJob = await TranscriptionJobModel.create({
      status: TranscriptionJobStatus.queued,
      chatId: 'source-url-proof-chat',
      telegramChatId: '123',
      sourceMessageId: 790,
      fileId: 'dirty-proof-file-id',
      sourceKind: TranscriptionJobSourceKind.voice,
      sourceUrl: tokenFileUrl('voice/file.ogg'),
    })
    const safeJob = await TranscriptionJobModel.create({
      status: TranscriptionJobStatus.queued,
      chatId: 'source-url-proof-chat',
      telegramChatId: '123',
      sourceMessageId: 791,
      fileId: 'safe-proof-file-id',
      sourceKind: TranscriptionJobSourceKind.voice,
      sourceUrl: 'https://media.example.invalid/voice/file.ogg',
    })
    const dirtyVoice = await VoiceModel.create({
      chatId: 'source-url-proof-chat',
      messageId: 792,
      fileId: 'dirty-voice-file-id',
      sourceType: 'voice',
      url: tokenFileUrl('voice/legacy.ogg'),
    })
    const safeVoice = await VoiceModel.create({
      chatId: 'source-url-proof-chat',
      messageId: 793,
      fileId: 'safe-voice-file-id',
      sourceType: 'voice',
      url: 'https://media.example.invalid/voice/legacy.ogg',
    })

    assert(
      !safeWorkerSourceUrl(dirtyJob.sourceUrl),
      'worker payloads must redact token-bearing sourceUrl'
    )
    assert(
      safeWorkerSourceUrl(safeJob.sourceUrl) === safeJob.sourceUrl,
      'worker payloads should preserve non-token sourceUrl fallback'
    )

    const dryRun = await scrubTokenBearingSourceUrls(true)
    assert(dryRun.transcriptionJobs.matched === 1, 'dry run should find job')
    assert(dryRun.voices.matched === 1, 'dry run should find voice')
    assert(dryRun.transcriptionJobs.modified === 0, 'dry run should not update')
    assert(dryRun.voices.modified === 0, 'dry run should not update voices')

    const scrubbed = await scrubTokenBearingSourceUrls()
    assert(scrubbed.transcriptionJobs.modified === 1, 'job should be scrubbed')
    assert(scrubbed.voices.modified === 1, 'voice should be scrubbed')

    const [refreshedDirtyJob, refreshedSafeJob, refreshedDirtyVoice, refreshedSafeVoice] =
      await Promise.all([
        TranscriptionJobModel.findById(dirtyJob._id),
        TranscriptionJobModel.findById(safeJob._id),
        VoiceModel.findById(dirtyVoice._id),
        VoiceModel.findById(safeVoice._id),
      ])

    assert(
      !refreshedDirtyJob.sourceUrl,
      'token-bearing job sourceUrl should be cleared'
    )
    assert(
      refreshedSafeJob.sourceUrl === safeJob.sourceUrl,
      'safe job sourceUrl should remain'
    )
    assert(!refreshedDirtyVoice.url, 'token-bearing Voice.url should be cleared')
    assert(
      refreshedSafeVoice.url === safeVoice.url,
      'safe Voice.url should remain'
    )

    console.log('source URL security proof passed')
  } finally {
    await cleanup()
    await mongoose.disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
