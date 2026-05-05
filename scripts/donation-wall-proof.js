#!/usr/bin/env node

process.env.TOKEN = process.env.TOKEN || '123456:proof-token-secret'
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy'

require('reflect-metadata')
require('module-alias/register')

const {
  isDonationWallEnabled,
  isTranscriptionAllowedByDonationWall,
} = require('../dist/helpers/donationWall')
const handleDonate = require('../dist/commands/handleDonate').default
const handleAudio = require('../dist/handlers/handleAudio').default
const stripeHelper = require('../dist/helpers/stripe')
const {
  TranscriptionJobModel,
  TranscriptionJobStatus,
} = require('../dist/models/TranscriptionJob')
const abuseLimits = require('../dist/helpers/transcriptionJobs/abuseLimits')
const goldenBorodutchAllowance = require('../dist/helpers/goldenBorodutchFreeTranscriptions')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function mockContext({ paid, chatType = 'channel' }) {
  const replies = []
  const chatActions = []

  return {
    replies,
    chatActions,
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
    api: {
      sendChatAction: async (chatId, action) => {
        chatActions.push({ chatId, action })
      },
    },
    reply: async (text, options) => {
      replies.push({ text, options })
      return { message_id: 222 }
    },
    timeReceived: new Date(),
  }
}

async function withPatchedStripeCheckout(callback) {
  const originalCreate = stripeHelper.stripe.checkout.sessions.create
  const createdSessions = []

  stripeHelper.stripe.checkout.sessions.create = async (session) => {
    createdSessions.push(session)
    return { url: 'https://stripe.test/donation-wall-proof' }
  }

  try {
    await callback(createdSessions)
  } finally {
    stripeHelper.stripe.checkout.sessions.create = originalCreate
  }
}

async function withPatchedQueue(callback, accessResult) {
  const originalCreate = TranscriptionJobModel.create
  const originalCheckLimits = abuseLimits.checkTranscriptionAbuseLimits
  const originalCheckAccess = goldenBorodutchAllowance.checkTranscriptionAccess
  const createdJobs = []

  TranscriptionJobModel.create = async (job) => {
    createdJobs.push(job)
    return {
      ...job,
      save: async () => undefined,
    }
  }
  abuseLimits.checkTranscriptionAbuseLimits = async () => undefined
  goldenBorodutchAllowance.checkTranscriptionAccess = async () =>
    accessResult || { allowed: true, consumedFreeTranscription: false }

  try {
    await callback(createdJobs)
  } finally {
    TranscriptionJobModel.create = originalCreate
    abuseLimits.checkTranscriptionAbuseLimits = originalCheckLimits
    goldenBorodutchAllowance.checkTranscriptionAccess = originalCheckAccess
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
    assert(
      ctx.replies.length === 1,
      'enabled wall should send subscriber guidance'
    )
    assert(
      ctx.replies[0].text === 'golden_borodutch_subscription_required',
      'subscriber copy should be used'
    )
  }, {
    allowed: false,
    consumedFreeTranscription: false,
    reason: 'subscription_required',
  })

  await withPatchedStripeCheckout(async (createdSessions) => {
    process.env.VOICY_DONATION_WALL_ENABLED = 'false'
    const ctx = mockContext({ paid: false, chatType: 'private' })
    await handleDonate(ctx)

    assert(
      createdSessions.length === 1,
      'disabled wall should keep /donate checkout available'
    )
    assert(
      ctx.chatActions.length === 1,
      'donate checkout should send typing action'
    )
    assert(ctx.replies.length === 1, 'donate checkout should reply once')
    assert(ctx.replies[0].text === 'pay', 'donate checkout should use pay copy')
    assert(
      ctx.replies[0].options.reply_markup.inline_keyboard[0][0].url ===
        'https://stripe.test/donation-wall-proof',
      'donate checkout should include Stripe session URL'
    )
  })

  delete process.env.VOICY_DONATION_WALL_ENABLED
  console.log('donation wall proof passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
