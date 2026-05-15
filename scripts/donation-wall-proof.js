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
  VOICY_STRIPE_FIXED_AMOUNTS,
  VOICY_STRIPE_MINIMUM_AMOUNT,
} = require('../dist/helpers/stripeCheckoutActivation')
const {
  TranscriptionJobModel,
  TranscriptionJobStatus,
} = require('../dist/models/TranscriptionJob')
const {
  TranscriptionResultCacheModel,
} = require('../dist/models/TranscriptionResultCache')
const { ChatModel } = require('../dist/models/Chat')
const abuseLimits = require('../dist/helpers/transcriptionJobs/abuseLimits')
const goldenBorodutchAllowance = require('../dist/helpers/goldenBorodutchFreeTranscriptions')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function telegramError(error_code, description) {
  const error = new Error(description)
  error.error_code = error_code
  error.description = description
  return error
}

function mockContext({
  paid,
  chatType = 'channel',
  text = '/donate',
  sendChatActionError,
  failReplyToMessageId,
}) {
  const replies = []
  const chatActions = []
  const chatSaves = []
  const dbchat = {
    id: `donation-wall-proof-${paid ? 'paid' : 'unpaid'}`,
    paid,
    transcribeAllAudio: true,
    uiLanguage: 'en',
    silent: false,
    save: async () => {
      chatSaves.push({
        botCanSendMessages: dbchat.botCanSendMessages,
        transcriptionDisabledUntilReachable:
          dbchat.transcriptionDisabledUntilReachable,
        transcriptionUnreachableReason: dbchat.transcriptionUnreachableReason,
        transcriptionUnreachableAt: dbchat.transcriptionUnreachableAt,
      })
    },
  }

  return {
    replies,
    chatActions,
    chatSaves,
    dbchat,
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
    message: {
      text,
    },
    match: text.replace(/^\/donate\s*/i, ''),
    i18n: {
      t: (key, data) => (data?.amount ? `${key}:${data.amount}` : key),
    },
    api: {
      sendChatAction: async (chatId, action) => {
        chatActions.push({ chatId, action })
        if (sendChatActionError) {
          throw sendChatActionError
        }
      },
    },
    reply: async (text, options) => {
      if (failReplyToMessageId && options?.reply_to_message_id) {
        throw telegramError(400, 'Bad Request: replied message not found')
      }
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
    return {
      url: `https://stripe.test/donation-wall-proof-${createdSessions.length}`,
    }
  }

  try {
    await callback(createdSessions)
  } finally {
    stripeHelper.stripe.checkout.sessions.create = originalCreate
  }
}

async function withPatchedQueue(
  callback,
  accessResult,
  abuseLimitResult,
  requesterPaid = false
) {
  const originalCreate = TranscriptionJobModel.create
  const originalFindJob = TranscriptionJobModel.findOne
  const originalUpdateMany = TranscriptionJobModel.updateMany
  const originalFindCache = TranscriptionResultCacheModel.findOne
  const originalChatExists = ChatModel.exists
  const originalCheckLimits = abuseLimits.checkTranscriptionAbuseLimits
  const originalCheckAccess = goldenBorodutchAllowance.checkTranscriptionAccess
  const createdJobs = []
  const abuseLimitChecks = []
  const paidRequesterChecks = []

  TranscriptionJobModel.create = async (job) => {
    const jobDoc = {
      ...job,
      saves: [],
      save: async () => {
        jobDoc.saves.push({
          status: jobDoc.status,
          failedAt: jobDoc.failedAt,
          lastError: jobDoc.lastError,
        })
      },
    }
    createdJobs.push(jobDoc)
    return jobDoc
  }
  TranscriptionJobModel.findOne = async () => undefined
  TranscriptionJobModel.updateMany = async () => ({ modifiedCount: 0 })
  TranscriptionResultCacheModel.findOne = async () => undefined
  ChatModel.exists = (query) => {
    paidRequesterChecks.push(query)
    return {
      exec: async () => (requesterPaid ? { _id: 'paid-requester-chat' } : null),
    }
  }
  abuseLimits.checkTranscriptionAbuseLimits = async (options) => {
    abuseLimitChecks.push(options)
    return typeof abuseLimitResult === 'function'
      ? abuseLimitResult(options)
      : abuseLimitResult
  }
  goldenBorodutchAllowance.checkTranscriptionAccess = async () => {
    if (accessResult instanceof Error) {
      throw accessResult
    }
    return accessResult || { allowed: true, consumedFreeTranscription: false }
  }

  try {
    await callback(createdJobs, abuseLimitChecks, paidRequesterChecks)
  } finally {
    TranscriptionJobModel.create = originalCreate
    TranscriptionJobModel.findOne = originalFindJob
    TranscriptionJobModel.updateMany = originalUpdateMany
    TranscriptionResultCacheModel.findOne = originalFindCache
    ChatModel.exists = originalChatExists
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

  await withPatchedQueue(
    async (createdJobs, abuseLimitChecks) => {
      process.env.VOICY_DONATION_WALL_ENABLED = 'false'
      const ctx = mockContext({ paid: true, chatType: 'private' })
      await handleAudio(ctx)

      assert(
        createdJobs.length === 1,
        'paid audio should enqueue when abuse counters are over limit'
      )
      assert(
        abuseLimitChecks.length === 1,
        'paid audio should still call the abuse-limit helper'
      )
      assert(
        abuseLimitChecks[0].chatPaid === true,
        'paid audio should pass donation state to abuse-limit helper'
      )
      assert(
        abuseLimitChecks[0].requesterPaid === true,
        'paid chat should also pass requester donation state'
      )
      assert(
        ctx.replies.length === 1,
        'paid audio should get normal queue progress'
      )
      assert(
        ctx.replies[0].text !== 'error_transcription_user_limited',
        'paid audio should not get rate-limit copy'
      )
    },
    undefined,
    (options) =>
      options.chatPaid
        ? undefined
        : { reason: 'user_rate_limited', limit: 4, windowMs: 120_000 }
  )

  await withPatchedQueue(
    async (createdJobs, abuseLimitChecks, paidRequesterChecks) => {
      process.env.VOICY_DONATION_WALL_ENABLED = 'false'
      const ctx = mockContext({ paid: false, chatType: 'supergroup' })
      await handleAudio(ctx)

      assert(
        createdJobs.length === 1,
        'paid requester should bypass throttles in an unpaid group'
      )
      assert(
        paidRequesterChecks.length === 1,
        'unpaid group should check requester donation status'
      )
      assert(
        paidRequesterChecks[0].id === '67890',
        'requester donation lookup should use Telegram requester id'
      )
      assert(
        abuseLimitChecks[0].chatPaid === false,
        'unpaid group should pass unpaid chat state'
      )
      assert(
        abuseLimitChecks[0].requesterPaid === true,
        'paid requester should pass requester donation state'
      )
      assert(
        ctx.replies[0].text !== 'error_transcription_user_limited',
        'paid requester should not get rate-limit copy'
      )
    },
    undefined,
    (options) =>
      options.requesterPaid
        ? undefined
        : { reason: 'user_rate_limited', limit: 4, windowMs: 120_000 },
    true
  )

  await withPatchedQueue(
    async (createdJobs, abuseLimitChecks) => {
      process.env.VOICY_DONATION_WALL_ENABLED = 'false'
      const ctx = mockContext({ paid: false, chatType: 'private' })
      await handleAudio(ctx)

      assert(
        createdJobs.length === 0,
        'unpaid audio should still be blocked by abuse limits'
      )
      assert(
        abuseLimitChecks.length === 1,
        'unpaid audio should call the abuse-limit helper'
      )
      assert(
        abuseLimitChecks[0].chatPaid === false,
        'unpaid audio should pass unpaid state to abuse-limit helper'
      )
      assert(
        abuseLimitChecks[0].requesterPaid === false,
        'unpaid audio should pass unpaid requester state'
      )
      assert(
        ctx.replies[0].text === 'error_transcription_user_limited',
        'unpaid audio should keep existing user limit copy'
      )
    },
    undefined,
    (options) =>
      options.chatPaid
        ? undefined
        : { reason: 'user_rate_limited', limit: 4, windowMs: 120_000 }
  )

  await withPatchedQueue(async (createdJobs) => {
    process.env.VOICY_DONATION_WALL_ENABLED = 'false'
    const ctx = mockContext({ paid: true, chatType: 'private' })
    ctx.dbchat.silent = true
    await handleAudio(ctx)

    assert(createdJobs.length === 1, 'silent audio should enqueue')
    assert(ctx.replies.length === 0, 'silent enqueue should not reply')
    assert(
      ctx.chatActions.length === 1,
      'silent enqueue should send a chat action'
    )
    assert(ctx.chatActions[0].chatId === 12345, 'chat action targets chat')
    assert(ctx.chatActions[0].action === 'typing', 'chat action is typing')
  })

  await withPatchedQueue(async (createdJobs) => {
    process.env.VOICY_DONATION_WALL_ENABLED = 'false'
    const ctx = mockContext({
      paid: true,
      chatType: 'private',
      sendChatActionError: telegramError(
        400,
        'Bad Request: not enough rights to send messages'
      ),
    })
    ctx.dbchat.silent = true
    await handleAudio(ctx)

    assert(
      createdJobs.length === 1,
      'silent audio should create the job before chat action'
    )
    assert(
      ctx.replies.length === 0,
      'silent chat action failure should not reply'
    )
    assert(
      ctx.chatActions.length === 1,
      'silent chat action failure should still attempt one chat action'
    )
    assert(
      ctx.chatSaves.length === 1,
      'permanent chat action failure should mark chat unreachable'
    )
    assert(
      ctx.dbchat.transcriptionDisabledUntilReachable === true,
      'chat should be blocked from future queueing'
    )
    assert(
      createdJobs[0].status === TranscriptionJobStatus.failed,
      'permanent chat action failure should fail the queued job'
    )
    assert(
      createdJobs[0].failedAt instanceof Date,
      'failed silent job should record failedAt'
    )
    assert(
      createdJobs[0].lastError ===
        'Telegram chat is unreachable for transcription',
      'failed silent job should record unreachable reason'
    )
    assert(
      createdJobs[0].saves.length === 1,
      'failed silent job should be saved'
    )
  })

  await withPatchedQueue(
    async (createdJobs) => {
      process.env.VOICY_DONATION_WALL_ENABLED = 'true'
      const ctx = mockContext({
        paid: false,
        chatType: 'private',
        failReplyToMessageId: true,
      })
      await handleAudio(ctx)

      assert(createdJobs.length === 0, 'enabled wall should block unpaid audio')
      assert(
        ctx.replies.length === 1,
        'enabled wall should retry subscriber guidance without reply target'
      )
      assert(
        ctx.replies[0].text === 'golden_borodutch_subscription_required',
        'subscriber copy should be used'
      )
      assert(
        !ctx.replies[0].options.reply_to_message_id,
        'fallback subscriber guidance should not keep invalid reply target'
      )
    },
    {
      allowed: false,
      consumedFreeTranscription: false,
      reason: 'subscription_required',
    }
  )

  await withPatchedQueue(
    async (createdJobs) => {
      process.env.VOICY_DONATION_WALL_ENABLED = 'true'
      const ctx = mockContext({ paid: false, chatType: 'private' })
      await handleAudio(ctx)

      assert(
        createdJobs.length === 0,
        'access-check failure should not enqueue audio'
      )
      assert(
        ctx.replies.length === 1,
        'access-check failure should still explain donation/subscription access'
      )
      assert(
        ctx.replies[0].text === 'golden_borodutch_membership_check_failed',
        'access-check failure should not fall through to generic queue error'
      )
    },
    new Error('database unavailable while recording membership check')
  )

  await withPatchedStripeCheckout(async (createdSessions) => {
    process.env.VOICY_DONATION_WALL_ENABLED = 'false'
    const ctx = mockContext({ paid: false, chatType: 'private' })
    await handleDonate(ctx)

    assert(
      createdSessions.length === VOICY_STRIPE_FIXED_AMOUNTS.length,
      'disabled wall should keep /donate fixed-tier checkouts available'
    )
    assert(
      ctx.chatActions.length === 1,
      'donate checkout should send typing action'
    )
    assert(ctx.replies.length === 1, 'donate checkout should reply once')
    assert(ctx.replies[0].text === 'pay', 'donate checkout should use pay copy')
    assert(
      ctx.replies[0].options.parse_mode === 'HTML',
      'donate checkout should render fixed-tier copy as HTML'
    )
    assert(
      ctx.replies[0].options.reply_markup.inline_keyboard.length ===
        VOICY_STRIPE_FIXED_AMOUNTS.length,
      'donate checkout should include one button per fixed tier'
    )
    for (const [index, amount] of VOICY_STRIPE_FIXED_AMOUNTS.entries()) {
      const createdSession = createdSessions[index]
      assert(
        createdSession.line_items[0].price_data.unit_amount === amount,
        'fixed tier checkout should use the selected amount'
      )
      assert(
        createdSession.line_items[0].price_data.tax_behavior === 'inclusive',
        'fixed tier checkout should set tax behavior for automatic tax'
      )
      assert(
        createdSession.metadata.voicy_donation_amount === `${amount}`,
        'fixed tier checkout should include amount metadata'
      )
      assert(
        createdSession.metadata.voicy_donation_tier === 'fixed',
        'fixed tier checkout should include fixed tier metadata'
      )
      assert(
        ctx.replies[0].options.reply_markup.inline_keyboard[index][0].url ===
          `https://stripe.test/donation-wall-proof-${index + 1}`,
        'donate checkout should include Stripe session URLs'
      )
    }
  })

  await withPatchedStripeCheckout(async (createdSessions) => {
    const customAmount = VOICY_STRIPE_MINIMUM_AMOUNT + 401
    const ctx = mockContext({
      paid: false,
      chatType: 'private',
      text: `/donate ${(customAmount / 100).toFixed(2)}`,
    })
    await handleDonate(ctx)

    assert(
      createdSessions.length === 1,
      'custom donation should create one checkout'
    )
    assert(
      createdSessions[0].line_items[0].price_data.unit_amount === customAmount,
      'custom donation checkout should use requested amount'
    )
    assert(
      createdSessions[0].metadata.voicy_donation_tier === 'custom',
      'custom donation checkout should include custom tier metadata'
    )
    assert(
      ctx.replies[0].text === `pay_custom:$${(customAmount / 100).toFixed(2)}`,
      'custom donation checkout should use custom copy'
    )
    assert(
      ctx.replies[0].options.parse_mode === 'HTML',
      'custom donation checkout should render copy as HTML'
    )
  })

  await withPatchedStripeCheckout(async (createdSessions) => {
    const belowMinimum = VOICY_STRIPE_MINIMUM_AMOUNT - 1
    const ctx = mockContext({
      paid: false,
      chatType: 'private',
      text: `/donate ${(belowMinimum / 100).toFixed(2)}`,
    })
    await handleDonate(ctx)

    assert(
      createdSessions.length === 0,
      'below-minimum custom donation should not create checkout'
    )
    assert(
      ctx.replies[0].text ===
        `pay_amount_too_low:$${(VOICY_STRIPE_MINIMUM_AMOUNT / 100).toFixed(2)}`,
      'below-minimum custom donation should explain the minimum'
    )
    assert(
      ctx.replies[0].options.parse_mode === 'HTML',
      'below-minimum custom donation should render copy as HTML'
    )
  })

  delete process.env.VOICY_DONATION_WALL_ENABLED
  console.log('donation wall proof passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
