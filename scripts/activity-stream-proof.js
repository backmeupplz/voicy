#!/usr/bin/env node

process.env.TOKEN = process.env.TOKEN || '123456:proof-token-secret'
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy'

require('reflect-metadata')
require('module-alias/register')

const assert = require('assert')
const http = require('http')
const {
  activityTextForTelegramCommand,
  activityTextForTelegramUpdate,
  activityTextForTranscriptionQueued,
  activityTextForWorkerJob,
  anonymizeIdentifier,
  emitActivityEvent,
} = require('../dist/helpers/activityStream')

const rawChatId = '-1001234567890'
const rawUserId = '123456789'
const rawMessageText = 'private transcript text must not leak'
const secret = 'activity-proof-secret'

function proofEnv(overrides = {}) {
  return {
    VOICY_ACTIVITY_STREAM_URL: 'http://127.0.0.1:0',
    VOICY_ACTIVITY_STREAM_TOKEN: 'activity-proof-token',
    VOICY_ACTIVITY_STREAM_ANONYMIZATION_SECRET: secret,
    ...overrides,
  }
}

function proofContext() {
  return {
    update: {
      update_id: 42,
      message: {},
    },
    chat: {
      id: Number(rawChatId),
      type: 'supergroup',
    },
    from: {
      id: Number(rawUserId),
    },
    msg: {
      message_id: 99,
      text: `/start ${rawMessageText}`,
      voice: {
        file_id: 'raw-file-id',
        file_unique_id: 'raw-file-unique-id',
      },
    },
  }
}

function assertSafeText(text) {
  assert(!text.includes(rawChatId), `raw chat id leaked in ${text}`)
  assert(!text.includes(rawUserId), `raw user id leaked in ${text}`)
  assert(!text.includes(rawMessageText), `message text leaked in ${text}`)
  assert(!text.includes('raw-file-id'), `file id leaked in ${text}`)
  assert(
    !text.includes('raw-file-unique-id'),
    `file unique id leaked in ${text}`
  )
}

async function withServer(handler) {
  const requests = []
  const server = http.createServer((request, response) => {
    let body = ''
    request.on('data', (chunk) => {
      body += chunk.toString()
    })
    request.on('end', () => {
      requests.push({
        url: request.url,
        authorization: request.headers.authorization,
        body: JSON.parse(body || '{}'),
      })
      response.writeHead(202, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ ok: true }))
    })
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('server did not expose a TCP address')
    }
    await handler(`http://127.0.0.1:${address.port}`, requests)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

async function main() {
  const env = proofEnv()
  Object.assign(process.env, env)
  const anonymizedChat = anonymizeIdentifier('chat', rawChatId, env)
  assert.strictEqual(
    anonymizedChat,
    anonymizeIdentifier('chat', rawChatId, env),
    'anonymization must be deterministic'
  )
  assert(!anonymizedChat.includes(rawChatId), 'anonymized chat contains raw id')

  const ctx = proofContext()
  const texts = [
    activityTextForTelegramUpdate(ctx),
    activityTextForTelegramCommand(ctx),
    activityTextForTranscriptionQueued(ctx, 'voice'),
    activityTextForWorkerJob(
      {
        telegramChatId: rawChatId,
        sourceKind: 'voice',
        attempts: 2,
      },
      'completed'
    ),
  ]

  for (const text of texts) {
    assert(text, 'expected proof text')
    assertSafeText(text)
  }

  const noOp = await emitActivityEvent(
    { text: 'Chat chat:g13d-proof sent a message' },
    {}
  )
  assert.strictEqual(noOp.emitted, false, 'missing env should no-op')
  assert.strictEqual(noOp.reason, 'not_configured')

  await withServer(async (baseUrl, requests) => {
    const result = await emitActivityEvent(
      { text: texts[0], project: 'voicy', source: 'bot' },
      proofEnv({ VOICY_ACTIVITY_STREAM_URL: baseUrl })
    )
    assert.strictEqual(result.emitted, true, 'configured emitter should post')
    assert.strictEqual(requests.length, 1, 'expected one submitted event')
    assert.strictEqual(requests[0].url, '/activity/v1/events')
    assert.strictEqual(requests[0].authorization, 'Bearer activity-proof-token')
    assert.strictEqual(requests[0].body.project, 'voicy')
    assert.strictEqual(requests[0].body.source, 'bot')
    assert.strictEqual(requests[0].body.text, texts[0])
    assertSafeText(JSON.stringify(requests[0].body))
  })

  console.log('activity stream proof passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
