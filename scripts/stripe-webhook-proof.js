#!/usr/bin/env node

process.env.TOKEN = process.env.TOKEN || '000000:test-token'
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy'
process.env.STRIPE_WEBHOOK_SIGNING_SECRET =
  process.env.STRIPE_WEBHOOK_SIGNING_SECRET || 'whsec_test'

require('reflect-metadata')
require('module-alias/register')

const {
  VOICY_STRIPE_CURRENCY,
  VOICY_STRIPE_FIXED_AMOUNTS,
  VOICY_STRIPE_METADATA_PURPOSE,
  VOICY_STRIPE_MINIMUM_AMOUNT,
  VOICY_STRIPE_TAX_BEHAVIOR,
  checkoutSessionActivationErrors,
  parseStripeDonationAmount,
  requireStripeWebhookSigningSecret,
  stripeCheckoutSessionRequest,
  stripeCheckoutMetadata,
  stripeDonationOption,
} = require('../dist/helpers/stripeCheckoutActivation')
const { stripe } = require('../dist/helpers/stripe')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function validSession(amount = VOICY_STRIPE_MINIMUM_AMOUNT, overrides = {}) {
  const chatId = '-1001234567890'
  const donation = stripeDonationOption(amount)
  return {
    id: 'cs_test_valid',
    client_reference_id: chatId,
    payment_status: 'paid',
    mode: 'payment',
    amount_subtotal: amount,
    amount_total: amount,
    currency: VOICY_STRIPE_CURRENCY,
    metadata: stripeCheckoutMetadata(chatId, donation),
    payment_intent: 'pi_test_valid',
    ...overrides,
  }
}

function validLineItems(amount = VOICY_STRIPE_MINIMUM_AMOUNT, overrides = {}) {
  return [
    {
      quantity: 1,
      price: {
        id: 'price_generated_by_checkout',
        unit_amount: amount,
        currency: VOICY_STRIPE_CURRENCY,
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

for (const amount of VOICY_STRIPE_FIXED_AMOUNTS) {
  assertValid(validSession(amount), validLineItems(amount))
  const request = stripeCheckoutSessionRequest(
    '-1001234567890',
    stripeDonationOption(amount)
  )
  assert(
    request.line_items[0].price_data.tax_behavior ===
      VOICY_STRIPE_TAX_BEHAVIOR,
    'checkout price data should include tax behavior for automatic tax'
  )
}
assertValid(
  validSession(VOICY_STRIPE_MINIMUM_AMOUNT + 432),
  validLineItems(VOICY_STRIPE_MINIMUM_AMOUNT + 432)
)
assert(
  parseStripeDonationAmount('$12.34') === 1234,
  'custom donation amount should parse'
)
assert(
  parseStripeDonationAmount('6.98') === VOICY_STRIPE_MINIMUM_AMOUNT - 1,
  'below-minimum donation amount should parse before validation'
)

assertInvalid(
  validSession(VOICY_STRIPE_MINIMUM_AMOUNT, { payment_status: 'unpaid' }),
  validLineItems(),
  'payment_status'
)
assertInvalid(
  validSession(VOICY_STRIPE_MINIMUM_AMOUNT, { mode: 'setup' }),
  validLineItems(),
  'mode'
)
assertInvalid(
  validSession(VOICY_STRIPE_MINIMUM_AMOUNT, {
    amount_subtotal: VOICY_STRIPE_MINIMUM_AMOUNT + 1,
  }),
  validLineItems(),
  'amount_subtotal'
)
assertInvalid(
  validSession(VOICY_STRIPE_MINIMUM_AMOUNT, {
    amount_total: VOICY_STRIPE_MINIMUM_AMOUNT - 1,
  }),
  validLineItems(),
  'amount_total'
)
assertInvalid(
  validSession(VOICY_STRIPE_MINIMUM_AMOUNT, { currency: 'eur' }),
  validLineItems(),
  'currency'
)
assertInvalid(
  validSession(VOICY_STRIPE_MINIMUM_AMOUNT, {
    metadata: {
      voicy_payment_purpose: VOICY_STRIPE_METADATA_PURPOSE,
      voicy_chat_id: 'other-chat',
      voicy_donation_amount: `${VOICY_STRIPE_MINIMUM_AMOUNT}`,
      voicy_donation_tier: 'fixed',
    },
  }),
  validLineItems(),
  'chat id mismatch'
)
assertInvalid(
  validSession(VOICY_STRIPE_MINIMUM_AMOUNT, {
    metadata: {
      ...stripeCheckoutMetadata(
        '-1001234567890',
        stripeDonationOption(VOICY_STRIPE_MINIMUM_AMOUNT)
      ),
      voicy_donation_amount: `${VOICY_STRIPE_MINIMUM_AMOUNT - 1}`,
    },
  }),
  validLineItems(),
  'below minimum'
)
assertInvalid(
  validSession(VOICY_STRIPE_MINIMUM_AMOUNT + 1, {
    metadata: {
      ...stripeCheckoutMetadata(
        '-1001234567890',
        stripeDonationOption(VOICY_STRIPE_MINIMUM_AMOUNT + 1)
      ),
      voicy_donation_tier: 'fixed',
    },
  }),
  validLineItems(VOICY_STRIPE_MINIMUM_AMOUNT + 1),
  'fixed donation amount'
)
assertInvalid(
  validSession(),
  validLineItems(VOICY_STRIPE_MINIMUM_AMOUNT + 1),
  'donation line item'
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
