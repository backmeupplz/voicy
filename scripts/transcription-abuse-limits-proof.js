#!/usr/bin/env node

require('module-alias/register')

const {
  TranscriptionAbuseLimitReason,
  checkTranscriptionAbuseLimits,
  transcriptionAbuseLimitSettings,
} = require('../dist/helpers/transcriptionJobs/abuseLimits')
const { TranscriptionJobStatus } = require('../dist/models/TranscriptionJob')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function counterFor(counts, queries) {
  return {
    countDocuments: async (query) => {
      queries.push(query)
      return counts.shift() || 0
    },
  }
}

async function assertLimit(counts, expectedReason) {
  const queries = []
  const result = await checkTranscriptionAbuseLimits({
    chatId: 'chat-1',
    userId: 'user-1',
    now: new Date('2026-05-05T12:00:00.000Z'),
    settings: {
      chatActiveJobLimit: 2,
      chatWindowMs: 60_000,
      chatWindowJobLimit: 3,
      userWindowMs: 120_000,
      userWindowJobLimit: 4,
    },
    counter: counterFor(counts, queries),
  })

  assert(result, `${expectedReason} should be enforced`)
  assert(result.reason === expectedReason, `expected ${expectedReason}`)
  return queries
}

async function main() {
  const queueQueries = await assertLimit(
    [2],
    TranscriptionAbuseLimitReason.chatQueueFull
  )
  assert(queueQueries.length === 1, 'queue cap should short-circuit checks')
  assert(
    queueQueries[0].status.$in.includes(
      TranscriptionJobStatus.queuedForDownload
    ),
    'active queue query should include queued downloads'
  )
  assert(
    queueQueries[0].status.$in.includes(TranscriptionJobStatus.transcribing),
    'active queue query should include transcribing jobs'
  )

  const chatQueries = await assertLimit(
    [0, 3],
    TranscriptionAbuseLimitReason.chatRateLimited
  )
  assert(chatQueries.length === 2, 'chat rate cap should stop before user cap')
  assert(
    chatQueries[1].createdAt.$gte.toISOString() === '2026-05-05T11:59:00.000Z',
    'chat rate window should use configured start time'
  )

  const userQueries = await assertLimit(
    [0, 0, 4],
    TranscriptionAbuseLimitReason.userRateLimited
  )
  assert(userQueries.length === 3, 'user rate cap should run after chat checks')
  assert(
    userQueries[2].requestedByUserId === 'user-1',
    'user rate query should scope by requesting user'
  )

  const noUserQueries = []
  const noUserResult = await checkTranscriptionAbuseLimits({
    chatId: 'chat-1',
    now: new Date('2026-05-05T12:00:00.000Z'),
    settings: {
      chatActiveJobLimit: 2,
      chatWindowMs: 60_000,
      chatWindowJobLimit: 3,
      userWindowMs: 120_000,
      userWindowJobLimit: 4,
    },
    counter: counterFor([0, 0, 4], noUserQueries),
  })
  assert(!noUserResult, 'missing user id should skip user rate cap')
  assert(
    noUserQueries.length === 2,
    'missing user id should not query user cap'
  )

  const paidChatQueries = []
  const paidChatResult = await checkTranscriptionAbuseLimits({
    chatId: 'chat-1',
    chatPaid: true,
    userId: 'user-1',
    now: new Date('2026-05-05T12:00:00.000Z'),
    settings: {
      chatActiveJobLimit: 2,
      chatWindowMs: 60_000,
      chatWindowJobLimit: 3,
      userWindowMs: 120_000,
      userWindowJobLimit: 4,
    },
    counter: counterFor([2, 3, 4], paidChatQueries),
  })
  assert(!paidChatResult, 'paid chats should bypass abuse limits')
  assert(
    paidChatQueries.length === 0,
    'paid chats should not query abuse-limit counters'
  )

  const paidRequesterQueries = []
  const paidRequesterResult = await checkTranscriptionAbuseLimits({
    chatId: 'chat-1',
    chatPaid: false,
    requesterPaid: true,
    userId: 'user-1',
    now: new Date('2026-05-05T12:00:00.000Z'),
    settings: {
      chatActiveJobLimit: 2,
      chatWindowMs: 60_000,
      chatWindowJobLimit: 3,
      userWindowMs: 120_000,
      userWindowJobLimit: 4,
    },
    counter: counterFor([2, 3, 4], paidRequesterQueries),
  })
  assert(!paidRequesterResult, 'paid requesters should bypass abuse limits')
  assert(
    paidRequesterQueries.length === 0,
    'paid requesters should not query abuse-limit counters'
  )

  const settings = transcriptionAbuseLimitSettings({
    VOICY_TRANSCRIPTION_CHAT_ACTIVE_JOB_LIMIT: '0',
    VOICY_TRANSCRIPTION_CHAT_WINDOW_MS: 'not-a-number',
    VOICY_TRANSCRIPTION_CHAT_WINDOW_JOB_LIMIT: '7',
    VOICY_TRANSCRIPTION_USER_WINDOW_MS: '5000',
    VOICY_TRANSCRIPTION_USER_WINDOW_JOB_LIMIT: '-1',
  })
  assert(settings.chatActiveJobLimit === 0, 'zero should disable active cap')
  assert(
    settings.chatWindowMs === 10 * 60 * 1000,
    'invalid chat window should use default'
  )
  assert(settings.chatWindowJobLimit === 7, 'valid chat cap should be used')
  assert(settings.userWindowMs === 5000, 'valid user window should be used')
  assert(
    settings.userWindowJobLimit === 5,
    'negative user cap should use default'
  )

  console.log('transcription abuse limits proof passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
