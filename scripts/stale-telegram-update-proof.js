const assert = require('assert/strict')

require('module-alias/register')

const ignoreOldMessageUpdates =
  require('../dist/middlewares/ignoreOldMessageUpdates').default
const {
  shouldIgnoreTelegramMessageUpdate,
} = require('../dist/helpers/staleTelegramUpdates')

async function runMiddleware(ctx, next) {
  await ignoreOldMessageUpdates(ctx, next)
}

function message(date, extra = {}) {
  return {
    message_id: extra.message_id || 101,
    date,
    voice: {
      file_id: 'stale-voice-file',
      file_unique_id: 'stale-voice-unique',
      duration: 1,
    },
  }
}

async function main() {
  const startupCutoffSeconds = 1_800_000_000
  const staleMessage = message(startupCutoffSeconds - 60)
  const freshMessage = message(startupCutoffSeconds + 1, { message_id: 102 })

  assert.deepEqual(
    shouldIgnoreTelegramMessageUpdate(staleMessage, {
      nowSeconds: startupCutoffSeconds + 2,
      startupCutoffSeconds,
      maxAgeSeconds: 300,
    }),
    {
      ignore: true,
      reason: 'before_startup',
      ageSeconds: 62,
    },
    'messages created before bot startup should be ignored'
  )

  assert.equal(
    shouldIgnoreTelegramMessageUpdate(freshMessage, {
      nowSeconds: startupCutoffSeconds + 2,
      startupCutoffSeconds,
      maxAgeSeconds: 300,
    }).ignore,
    false,
    'fresh post-startup messages should be processed'
  )

  let staleNextCalled = false
  let staleReplyCount = 0
  let staleTranscriptionJobCreated = false
  await runMiddleware(
    {
      update: { update_id: 5001 },
      message: message(Math.floor(Date.now() / 1000) - 3600),
      chat: { type: 'private' },
      reply: async () => {
        staleReplyCount += 1
      },
    },
    async () => {
      staleNextCalled = true
      staleTranscriptionJobCreated = true
    }
  )

  assert.equal(staleNextCalled, false, 'stale audio update should stop pipeline')
  assert.equal(
    staleTranscriptionJobCreated,
    false,
    'stale audio update should not create a TranscriptionJob'
  )
  assert.equal(
    staleReplyCount,
    0,
    'stale audio update should not send a Telegram reply or edit'
  )

  let freshNextCalled = false
  await runMiddleware(
    {
      update: { update_id: 5002 },
      message: message(Math.floor(Date.now() / 1000), { message_id: 103 }),
      chat: { type: 'private' },
    },
    async () => {
      freshNextCalled = true
    }
  )

  assert.equal(freshNextCalled, true, 'fresh audio update should continue')

  console.log(
    JSON.stringify(
      {
        ok: true,
        staleAudioUpdate: {
          nextCalled: staleNextCalled,
          transcriptionJobCreated: staleTranscriptionJobCreated,
          replyCount: staleReplyCount,
        },
        freshAudioUpdate: {
          nextCalled: freshNextCalled,
        },
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
