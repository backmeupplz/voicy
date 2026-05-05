#!/usr/bin/env node

process.env.TOKEN = process.env.TOKEN || '000000:test-token'
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy'
process.env.STRIPE_WEBHOOK_SIGNING_SECRET =
  process.env.STRIPE_WEBHOOK_SIGNING_SECRET || 'whsec_test'

require('reflect-metadata')
require('module-alias/register')

const {
  VOICY_STRIPE_CURRENCY,
  VOICY_STRIPE_EXPECTED_AMOUNT,
  VOICY_STRIPE_METADATA_PURPOSE,
  VOICY_STRIPE_PRICE_ID,
  checkoutSessionActivationErrors,
  requireStripeWebhookSigningSecret,
  stripeCheckoutMetadata,
} = require('../dist/helpers/stripeCheckoutActivation')
const { stripe } = require('../dist/helpers/stripe')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function validSession(overrides = {}) {
  const chatId = '-1001234567890'
  return {
    id: 'cs_test_valid',
    client_reference_id: chatId,
    payment_status: 'paid',
    mode: 'payment',
    amount_subtotal: VOICY_STRIPE_EXPECTED_AMOUNT,
    amount_total: VOICY_STRIPE_EXPECTED_AMOUNT,
    currency: VOICY_STRIPE_CURRENCY,
    metadata: stripeCheckoutMetadata(chatId),
    payment_intent: 'pi_test_valid',
    ...overrides,
  }
}

function validLineItems(overrides = {}) {
  return [
    {
      quantity: 1,
      price: {
        id: VOICY_STRIPE_PRICE_ID,
      },
      ...overrides,
    },
  ]
}

function assertValid(session = validSession(), lineItems = validLineItems()) {
  const errors = checkoutSessionActivationErrors(session, lineItems)
  assert(
    errors.length === 0,
    `expected checkout session to pass validation, got ${errors.join(', ')}`
  )
}

function assertInvalid(session, lineItems, expectedError) {
  const errors = checkoutSessionActivationErrors(session, lineItems)
  assert(
    errors.some((error) => error.includes(expectedError)),
    `expected "${expectedError}" validation error, got ${errors.join(', ')}`
  )
}

const secret = requireStripeWebhookSigningSecret()
assert(secret === process.env.STRIPE_WEBHOOK_SIGNING_SECRET, 'secret mismatch')
assertValid()

assertInvalid(
  validSession({ payment_status: 'unpaid' }),
  validLineItems(),
  'payment_status'
)
assertInvalid(validSession({ mode: 'setup' }), validLineItems(), 'mode')
assertInvalid(
  validSession({ amount_subtotal: VOICY_STRIPE_EXPECTED_AMOUNT + 1 }),
  validLineItems(),
  'amount_subtotal'
)
assertInvalid(
  validSession({ amount_total: VOICY_STRIPE_EXPECTED_AMOUNT - 1 }),
  validLineItems(),
  'amount_total'
)
assertInvalid(
  validSession({ currency: 'eur' }),
  validLineItems(),
  'currency'
)
assertInvalid(
  validSession({
    metadata: {
      voicy_payment_purpose: VOICY_STRIPE_METADATA_PURPOSE,
      voicy_chat_id: 'other-chat',
      voicy_price_id: VOICY_STRIPE_PRICE_ID,
    },
  }),
  validLineItems(),
  'chat id mismatch'
)
assertInvalid(
  validSession({
    metadata: {
      ...stripeCheckoutMetadata('-1001234567890'),
      voicy_price_id: 'price_wrong',
    },
  }),
  validLineItems(),
  'metadata price id mismatch'
)
assertInvalid(
  validSession(),
  validLineItems({ price: { id: 'price_wrong' } }),
  'price line item'
)

const payload = JSON.stringify({
  id: 'evt_test_checkout_completed',
  object: 'event',
  type: 'checkout.session.completed',
  data: {
    object: validSession(),
  },
})
const signature = stripe.webhooks.generateTestHeaderString({
  payload,
  secret,
})
const event = stripe.webhooks.constructEvent(
  Buffer.from(payload),
  signature,
  secret
)
assert(
  event.type === 'checkout.session.completed',
  'signed webhook payload should construct a checkout completion event'
)

let rejectedTamperedPayload = false
try {
  stripe.webhooks.constructEvent(
    Buffer.from(payload.replace('paid', 'unpaid')),
    signature,
    secret
  )
} catch (error) {
  rejectedTamperedPayload = true
}
assert(rejectedTamperedPayload, 'tampered webhook payload should be rejected')

console.log('stripe webhook proof passed')
