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
    settings: {
      chatActiveJobLimit: 2,
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

  const allowedQueries = []
  const allowedResult = await checkTranscriptionAbuseLimits({
    chatId: 'chat-1',
    settings: {
      chatActiveJobLimit: 2,
    },
    counter: counterFor([0], allowedQueries),
  })
  assert(!allowedResult, 'jobs below the active queue cap should be allowed')
  assert(
    allowedQueries.length === 1,
    'allowed jobs should only query the active queue cap'
  )

  const paidChatQueries = []
  const paidChatResult = await checkTranscriptionAbuseLimits({
    chatId: 'chat-1',
    chatPaid: true,
    settings: {
      chatActiveJobLimit: 2,
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
    settings: {
      chatActiveJobLimit: 2,
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
  })
  assert(settings.chatActiveJobLimit === 0, 'zero should disable active cap')

  console.log('transcription abuse limits proof passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
