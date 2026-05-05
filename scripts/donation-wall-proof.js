#!/usr/bin/env node

process.env.TOKEN = process.env.TOKEN || '123456:proof-token-secret'
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy'

require('reflect-metadata')
require('module-alias/register')

const {
  isDonationWallEnabled,
  isTranscriptionAllowedByDonationWall,
} = require('../dist/helpers/donationWall')
const handleAudio = require('../dist/handlers/handleAudio').default
const {
  TranscriptionJobModel,
  TranscriptionJobStatus,
} = require('../dist/models/TranscriptionJob')
const abuseLimits = require('../dist/helpers/transcriptionJobs/abuseLimits')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function mockContext({ paid, chatType = 'channel' }) {
  const replies = []

  return {
    replies,
    dbchat: {
      id: `donation-wall-proof-${paid ? 'paid' : 'unpaid'}`,
      paid,
      transcribeAllAudio: true,
      uiLanguage: 'en',
      silent: false,
    },
    chat: { id: 12345, type: chatType },
    from: { id: 67890 },
    msg: {
      message_id: 111,
      voice: {
        file_id: 'proof-file-id',
        file_unique_id: 'proof-file-unique-id',
        file_size: 4096,
      },
    },
    i18n: {
      t: (key) => key,
    },
    reply: async (text, options) => {
      replies.push({ text, options })
      return { message_id: 222 }
    },
    timeReceived: new Date(),
  }
}

async function withPatchedQueue(callback) {
  const originalCreate = TranscriptionJobModel.create
  const originalCheckLimits = abuseLimits.checkTranscriptionAbuseLimits
  const createdJobs = []

  TranscriptionJobModel.create = async (job) => {
    createdJobs.push(job)
    return {
      ...job,
      save: async () => undefined,
    }
  }
  abuseLimits.checkTranscriptionAbuseLimits = async () => undefined

  try {
    await callback(createdJobs)
  } finally {
    TranscriptionJobModel.create = originalCreate
    abuseLimits.checkTranscriptionAbuseLimits = originalCheckLimits
  }
}

async function main() {
  assert(!isDonationWallEnabled({}), 'donation wall defaults to disabled')
  assert(
    !isDonationWallEnabled({ VOICY_DONATION_WALL_ENABLED: 'false' }),
    'false disables donation wall'
  )
  assert(
    isDonationWallEnabled({ VOICY_DONATION_WALL_ENABLED: 'true' }),
    'true enables donation wall'
  )
  assert(
    isTranscriptionAllowedByDonationWall(
      { paid: false },
      { VOICY_DONATION_WALL_ENABLED: 'false' }
    ),
    'disabled wall allows unpaid chats'
  )
  assert(
    !isTranscriptionAllowedByDonationWall(
      { paid: false },
      { VOICY_DONATION_WALL_ENABLED: 'true' }
    ),
    'enabled wall blocks unpaid chats'
  )
  assert(
    isTranscriptionAllowedByDonationWall(
      { paid: true },
      { VOICY_DONATION_WALL_ENABLED: 'true' }
    ),
    'enabled wall allows paid chats'
  )

  await withPatchedQueue(async (createdJobs) => {
    process.env.VOICY_DONATION_WALL_ENABLED = 'false'
    const ctx = mockContext({ paid: false })
    await handleAudio(ctx)

    assert(
      createdJobs.length === 1,
      'disabled wall should enqueue unpaid audio'
    )
    assert(ctx.replies.length === 0, 'channel enqueue should not send donate')
    assert(
      createdJobs[0].status === TranscriptionJobStatus.queuedForDownload,
      'queued job should use download queue status'
    )
  })

  await withPatchedQueue(async (createdJobs) => {
    process.env.VOICY_DONATION_WALL_ENABLED = 'true'
    const ctx = mockContext({ paid: false, chatType: 'private' })
    await handleAudio(ctx)

    assert(createdJobs.length === 0, 'enabled wall should block unpaid audio')
    assert(ctx.replies.length === 1, 'enabled wall should send donate guidance')
    assert(ctx.replies[0].text === 'sunsetting', 'donate copy should be used')
  })

  delete process.env.VOICY_DONATION_WALL_ENABLED
  console.log('donation wall proof passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
