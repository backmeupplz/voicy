#!/usr/bin/env node

require('module-alias/register')

const assert = require('assert')

const {
  default: configureTelegramApiRetry,
  telegramApiRetryOptions,
} = require('../dist/helpers/configureTelegramApiRetry')

function composeTransformers(baseCall, transformers) {
  return transformers.reduce(
    (prev, transformer) => (method, payload, signal) =>
      transformer(prev, method, payload, signal),
    baseCall
  )
}

function configuredTransformers() {
  const transformers = []
  configureTelegramApiRetry({
    use: (...installed) => transformers.push(...installed),
  })
  return transformers
}

async function provesRateLimitIsLoggedAndRetried(method, payload) {
  const transformers = configuredTransformers()
  const logs = []
  const originalWarn = console.warn
  const calls = []

  console.warn = (...args) => logs.push(args)

  try {
    const call = composeTransformers(async (apiMethod, apiPayload) => {
      calls.push({ method: apiMethod, payload: apiPayload })
      if (calls.length === 1) {
        return {
          ok: false,
          error_code: 429,
          description: 'Too Many Requests: retry after 0.01',
          parameters: { retry_after: 0.01 },
        }
      }
      return { ok: true, result: { message_id: 123 } }
    }, transformers)

    const result = await call(method, payload)

    assert.deepEqual(result, { ok: true, result: { message_id: 123 } })
    assert.equal(calls.length, 2, '429 response should be retried once')
    assert.equal(calls[0].method, method)
    assert.equal(
      calls[1].payload,
      payload,
      'retry should preserve the original API payload exactly'
    )
    assert.equal(logs.length, 1, 'rate-limit retry should be logged once')
    assert.equal(logs[0][0], 'Telegram API rate limit received')
    assert.equal(logs[0][1].method, method)
    assert.equal(logs[0][1].retryAfterSeconds, 0.01)
    assert.equal(logs[0][1].willAutoRetry, true)
    assert.equal(
      Object.prototype.hasOwnProperty.call(logs[0][1], 'text'),
      false,
      'retry log must not include Telegram message contents'
    )
  } finally {
    console.warn = originalWarn
  }
}

async function provesPermanentErrorsAreNotRetried() {
  const transformers = configuredTransformers()
  let calls = 0
  const call = composeTransformers(async () => {
    calls += 1
    return {
      ok: false,
      error_code: 403,
      description: 'Forbidden: bot was kicked from the chat',
    }
  }, transformers)

  const result = await call('editMessageText', {
    chat_id: 123,
    message_id: 456,
    text: 'proof text',
  })

  assert.equal(result.ok, false)
  assert.equal(result.error_code, 403)
  assert.equal(
    result.description,
    'Forbidden: bot was kicked from the chat',
    'permanent Telegram errors should surface unchanged'
  )
  assert.equal(calls, 1, 'permanent errors should not be retried')
}

async function provesRetryOptionsUseBoundedDefaults() {
  assert.deepEqual(telegramApiRetryOptions({}), {
    maxRetryAttempts: 3,
    maxDelaySeconds: 120,
  })
  assert.deepEqual(
    telegramApiRetryOptions({
      VOICY_TELEGRAM_API_MAX_RETRY_ATTEMPTS: '2',
      VOICY_TELEGRAM_API_MAX_RETRY_AFTER_SECONDS: '10',
    }),
    {
      maxRetryAttempts: 2,
      maxDelaySeconds: 10,
    }
  )
}

async function main() {
  await provesRateLimitIsLoggedAndRetried('sendMessage', {
    chat_id: 123,
    text: 'proof text',
  })
  await provesRateLimitIsLoggedAndRetried('editMessageText', {
    chat_id: 123,
    message_id: 456,
    text: 'proof text',
  })
  await provesPermanentErrorsAreNotRetried()
  await provesRetryOptionsUseBoundedDefaults()
  console.log('telegram api retry proof passed')
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
