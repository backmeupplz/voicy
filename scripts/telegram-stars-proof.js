#!/usr/bin/env node

process.env.TOKEN = process.env.TOKEN || '000000:test-token'
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy'
process.env.TELEGRAM_STARS_PAYLOAD_SECRET =
  process.env.TELEGRAM_STARS_PAYLOAD_SECRET || 'stars-proof-secret'
process.env.TELEGRAM_STARS_MINIMUM_AMOUNT =
  process.env.TELEGRAM_STARS_MINIMUM_AMOUNT || '100'
process.env.TELEGRAM_STARS_FIXED_AMOUNTS =
  process.env.TELEGRAM_STARS_FIXED_AMOUNTS || '100,250,500'

require('reflect-metadata')
require('module-alias/register')

const {
  TELEGRAM_STARS_CURRENCY,
  TELEGRAM_STARS_PROVIDER_TOKEN,
  VOICY_TELEGRAM_STARS_FIXED_AMOUNTS,
  VOICY_TELEGRAM_STARS_MINIMUM_AMOUNT,
  activateTelegramStarsPayment,
  createTelegramStarsInvoicePayload,
  formatTelegramStarsDonationAmount,
  parseTelegramStarsInvoicePayload,
  telegramStarsActivationConfirmationText,
  telegramStarsDonationOption,
  telegramStarsInvoiceLinkRequest,
  telegramStarsPaymentValidationErrors,
  telegramStarsPreCheckoutErrors,
} = require('../dist/helpers/telegramStarsActivation')
const { ChatModel } = require('../dist/models/Chat')
const bot = require('../dist/helpers/bot').default

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function validPayload(amount = VOICY_TELEGRAM_STARS_MINIMUM_AMOUNT) {
  return createTelegramStarsInvoicePayload(
    '-1001234567890',
    telegramStarsDonationOption(amount),
    'proofnonce'
  )
}

function validPayment(overrides = {}) {
  return {
    currency: TELEGRAM_STARS_CURRENCY,
    total_amount: VOICY_TELEGRAM_STARS_MINIMUM_AMOUNT,
    invoice_payload: validPayload(),
    telegram_payment_charge_id: 'tg_charge_test',
    provider_payment_charge_id: '',
    ...overrides,
  }
}

function validChat(overrides = {}) {
  const chat = {
    id: '-1001234567890',
    paid: false,
    uiLanguage: 'en',
    saves: 0,
    save: async () => {
      chat.saves += 1
    },
    ...overrides,
  }
  return chat
}

async function withPatchedChat(chat, callback) {
  const originalFindOne = ChatModel.findOne
  const originalSendMessage = bot.api.sendMessage
  const sentMessages = []

  ChatModel.findOne = async (query) => {
    assert(
      query.id === '-1001234567890',
      `Stars activation should look up the signed target chat, got ${query.id}`
    )
    return chat
  }
  bot.api.sendMessage = async (chatId, text, options) => {
    sentMessages.push({ chatId, text, options })
  }

  try {
    await callback(sentMessages)
  } finally {
    ChatModel.findOne = originalFindOne
    bot.api.sendMessage = originalSendMessage
  }
}

const payload = validPayload()
assert(
  Buffer.byteLength(payload, 'utf8') <= 128,
  'Stars invoice payload should fit Telegram 128-byte payload limit'
)
const metadata = parseTelegramStarsInvoicePayload(payload)
assert(metadata, 'signed Stars payload should parse')
assert(metadata.chatId === '-1001234567890', 'payload should include chat id')
assert(
  metadata.amount === VOICY_TELEGRAM_STARS_MINIMUM_AMOUNT,
  'payload should include amount'
)
assert(metadata.tier === 'fixed', 'payload should include tier')
assert(
  !parseTelegramStarsInvoicePayload(payload.replace('-100', '-200')),
  'tampered Stars payload should be rejected'
)
assert(
  formatTelegramStarsDonationAmount(250) === '250 Stars',
  'Stars amount should be formatted without USD equivalence'
)

for (const amount of VOICY_TELEGRAM_STARS_FIXED_AMOUNTS) {
  const request = telegramStarsInvoiceLinkRequest(
    '-1001234567890',
    telegramStarsDonationOption(amount),
    {
      title: 'Voicy chat activation',
      description: 'Proof invoice',
      label: `Voicy activation: ${amount} Stars`,
    },
    `nonce-${amount}`
  )
  assert(request.currency === TELEGRAM_STARS_CURRENCY, 'invoice should use XTR')
  assert(
    request.provider_token === TELEGRAM_STARS_PROVIDER_TOKEN,
    'invoice should use empty provider token'
  )
  assert(request.prices[0].amount === amount, 'invoice should use Stars amount')
}

function assertInvalid(payment, expectedError) {
  const errors = telegramStarsPaymentValidationErrors(payment)
  assert(
    errors.some((error) => error.includes(expectedError)),
    `expected "${expectedError}" validation error, got ${errors.join(', ')}`
  )
}

assert(
  telegramStarsPaymentValidationErrors(validPayment()).length === 0,
  'valid Stars payment should pass validation'
)
assertInvalid(validPayment({ currency: 'USD' }), 'currency')
assertInvalid(
  validPayment({ total_amount: VOICY_TELEGRAM_STARS_MINIMUM_AMOUNT + 1 }),
  'total_amount'
)
assertInvalid(
  validPayment({ invoice_payload: payload.replace('proofnonce', 'other') }),
  'payload'
)

async function main() {
  await withPatchedChat(validChat(), async (sentMessages) => {
    const acceptedErrors = await telegramStarsPreCheckoutErrors(validPayment())
    assert(
      acceptedErrors.length === 0,
      `valid pre-checkout should be accepted, got ${acceptedErrors.join(', ')}`
    )
    const activated = await activateTelegramStarsPayment(validPayment(), 777)
    assert(activated, 'valid Stars payment should activate chat')
    assert(sentMessages.length === 1, 'fresh activation should send one message')
    assert(sentMessages[0].chatId === '-1001234567890', 'confirmation target')
  })

  await withPatchedChat(validChat({ paid: true }), async () => {
    const errors = await telegramStarsPreCheckoutErrors(validPayment())
    assert(
      errors.some((error) => error.includes('already activated')),
      'pre-checkout should reject already paid target chat'
    )
  })

  const duplicateChat = validChat({
    paid: true,
    telegramPaymentChargeId: 'tg_charge_test',
  })
  await withPatchedChat(duplicateChat, async (sentMessages) => {
    const activated = await activateTelegramStarsPayment(validPayment(), 777)
    assert(activated, 'duplicate Stars payment should be idempotent')
    assert(duplicateChat.saves === 0, 'duplicate payment should not save again')
    assert(
      sentMessages.length === 0,
      'duplicate payment should not send another confirmation'
    )
  })

  for (const [locale, expectedFragment] of [
    ['de', 'aktiviert'],
    ['en', 'activated for this chat'],
    ['es', 'activado para este chat'],
    ['pt', 'ativado para este chat'],
    ['ru', 'для этого чата'],
    ['uk', 'для цього чату'],
  ]) {
    assert(
      telegramStarsActivationConfirmationText(
        validChat({ uiLanguage: locale })
      ).includes(expectedFragment),
      `${locale} Stars activation confirmation should be localized`
    )
  }

  console.log('telegram stars proof passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
