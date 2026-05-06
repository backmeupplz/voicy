import { Chat, ChatModel } from '@/models/Chat'
import { DocumentType } from '@typegoose/typegoose'
import { stripe } from '@/helpers/stripe'
import Stripe from 'stripe'

export const VOICY_STRIPE_MINIMUM_AMOUNT = Number(
  process.env.STRIPE_MINIMUM_AMOUNT ||
    process.env.STRIPE_EXPECTED_AMOUNT ||
    process.env.STRIPE_AMOUNT_TOTAL ||
    699
)
export const VOICY_STRIPE_FIXED_AMOUNTS = (
  process.env.STRIPE_FIXED_AMOUNTS || '699,999,1299,1599'
)
  .split(',')
  .map((amount) => Number(amount.trim()))
  .filter(
    (amount) =>
      Number.isInteger(amount) && amount >= VOICY_STRIPE_MINIMUM_AMOUNT
  )
export const VOICY_STRIPE_CURRENCY = (
  process.env.STRIPE_CURRENCY || 'usd'
).toLowerCase()
export const VOICY_STRIPE_METADATA_PURPOSE = 'voicy_chat_activation'
export const VOICY_STRIPE_CUSTOM_TIER = 'custom'
export const VOICY_STRIPE_PRODUCT_NAME =
  process.env.STRIPE_PRODUCT_NAME || 'Voicy chat transcription activation'
export const VOICY_STRIPE_TAX_BEHAVIOR =
  process.env.STRIPE_TAX_BEHAVIOR === 'exclusive' ? 'exclusive' : 'inclusive'

export type StripeDonationTier = 'fixed' | 'custom'

export interface StripeDonationOption {
  amount: number
  tier: StripeDonationTier
}

export function requireStripeWebhookSigningSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SIGNING_SECRET
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SIGNING_SECRET is required')
  }
  return secret
}

export function formatStripeDonationAmount(amount: number) {
  return `$${(amount / 100).toFixed(2)}`
}

export function stripeCheckoutMetadata(
  chatId: string,
  donation: StripeDonationOption
) {
  return {
    voicy_payment_purpose: VOICY_STRIPE_METADATA_PURPOSE,
    voicy_chat_id: chatId,
    voicy_donation_amount: `${donation.amount}`,
    voicy_donation_tier: donation.tier,
  }
}

export function stripeDonationOption(amount: number): StripeDonationOption {
  if (!Number.isInteger(amount) || amount < VOICY_STRIPE_MINIMUM_AMOUNT) {
    throw new Error(
      `Donation amount must be at least ${VOICY_STRIPE_MINIMUM_AMOUNT} cents`
    )
  }
  return {
    amount,
    tier: VOICY_STRIPE_FIXED_AMOUNTS.includes(amount) ? 'fixed' : 'custom',
  }
}

export function parseStripeDonationAmount(input?: string) {
  const value = input?.trim()
  if (!value) {
    return undefined
  }
  const match = value.match(/^\$?([0-9]+)(?:[.,]([0-9]{1,2}))?$/)
  if (!match) {
    return undefined
  }
  const dollars = Number(match[1])
  const cents = Number((match[2] || '').padEnd(2, '0') || '0')
  if (!Number.isSafeInteger(dollars) || !Number.isSafeInteger(cents)) {
    return undefined
  }
  return dollars * 100 + cents
}

function paymentIntentId(session: Stripe.Checkout.Session) {
  const paymentIntent = session.payment_intent
  if (!paymentIntent) {
    return undefined
  }
  return typeof paymentIntent === 'string' ? paymentIntent : paymentIntent.id
}

function lineItemPrice(lineItem: Stripe.LineItem) {
  const price = lineItem.price
  if (!price || typeof price === 'string') {
    return undefined
  }
  return price
}

function lineItemUnitAmount(lineItem: Stripe.LineItem) {
  const price = lineItemPrice(lineItem)
  const subtotal = (lineItem as Stripe.LineItem & { amount_subtotal?: number })
    .amount_subtotal
  return price?.unit_amount || subtotal
}

function lineItemCurrency(lineItem: Stripe.LineItem) {
  return lineItemPrice(lineItem)?.currency?.toLowerCase()
}

function metadataAmount(metadata: Stripe.Metadata) {
  const amount = Number(metadata.voicy_donation_amount)
  return Number.isInteger(amount) ? amount : undefined
}

function metadataTier(metadata: Stripe.Metadata) {
  return metadata.voicy_donation_tier === VOICY_STRIPE_CUSTOM_TIER
    ? 'custom'
    : metadata.voicy_donation_tier === 'fixed'
    ? 'fixed'
    : undefined
}

export function checkoutSessionActivationErrors(
  session: Stripe.Checkout.Session,
  lineItems: Stripe.LineItem[]
) {
  const errors: string[] = []
  const clientReferenceId = session.client_reference_id
  const metadata = session.metadata || {}
  const amount = metadataAmount(metadata)
  const tier = metadataTier(metadata)

  if (!clientReferenceId) {
    errors.push('missing client_reference_id')
  }
  if (session.payment_status !== 'paid') {
    errors.push(`unexpected payment_status ${session.payment_status}`)
  }
  if (session.mode !== 'payment') {
    errors.push(`unexpected mode ${session.mode}`)
  }
  if (typeof amount !== 'number') {
    errors.push('missing donation amount metadata')
  }
  if (
    typeof amount === 'number' &&
    (amount < VOICY_STRIPE_MINIMUM_AMOUNT || !Number.isInteger(amount))
  ) {
    errors.push(`donation amount below minimum ${amount}`)
  }
  if (tier === undefined) {
    errors.push('missing donation tier metadata')
  }
  if (
    tier === 'fixed' &&
    typeof amount === 'number' &&
    !VOICY_STRIPE_FIXED_AMOUNTS.includes(amount)
  ) {
    errors.push(`unexpected fixed donation amount ${amount}`)
  }
  if (session.amount_subtotal !== amount) {
    errors.push(`unexpected amount_subtotal ${session.amount_subtotal}`)
  }
  if (
    typeof session.amount_total !== 'number' ||
    typeof amount !== 'number' ||
    session.amount_total < amount
  ) {
    errors.push(`unexpected amount_total ${session.amount_total}`)
  }
  if (session.currency?.toLowerCase() !== VOICY_STRIPE_CURRENCY) {
    errors.push(`unexpected currency ${session.currency}`)
  }
  if (metadata.voicy_payment_purpose !== VOICY_STRIPE_METADATA_PURPOSE) {
    errors.push('missing voicy payment metadata')
  }
  if (metadata.voicy_chat_id !== clientReferenceId) {
    errors.push('metadata chat id mismatch')
  }
  if (
    !lineItems.some((lineItem) => {
      return (
        lineItem.quantity === 1 &&
        lineItemUnitAmount(lineItem) === amount &&
        lineItemCurrency(lineItem) === VOICY_STRIPE_CURRENCY
      )
    })
  ) {
    errors.push('expected Stripe donation line item not found')
  }

  return errors
}

export function stripeCheckoutSessionRequest(
  chatId: string,
  donation: StripeDonationOption
): Stripe.Checkout.SessionCreateParams {
  return {
    line_items: [
      {
        price_data: {
          currency: VOICY_STRIPE_CURRENCY,
          product_data: {
            name: VOICY_STRIPE_PRODUCT_NAME,
          },
          tax_behavior: VOICY_STRIPE_TAX_BEHAVIOR,
          unit_amount: donation.amount,
        },
        quantity: 1,
      },
    ],
    success_url: 'https://t.me/voicybot',
    cancel_url: 'https://t.me/voicybot',
    client_reference_id: chatId,
    metadata: stripeCheckoutMetadata(chatId, donation),
    mode: 'payment',
    automatic_tax: {
      enabled: true,
    },
  }
}

function storeStripeActivation(
  chat: DocumentType<Chat>,
  session: Stripe.Checkout.Session
) {
  chat.paid = true
  chat.stripeCheckoutSessionId = session.id
  chat.stripePaymentIntentId = paymentIntentId(session)
  chat.stripePaidAt = new Date()
  chat.stripeAmountSubtotal = session.amount_subtotal || undefined
  chat.stripeAmountTotal = session.amount_total || undefined
  chat.stripeCurrency = session.currency?.toLowerCase()
  chat.stripePriceId = undefined
  chat.stripeDonationTier = session.metadata?.voicy_donation_tier
}

export async function activatePaidCheckoutSession(
  session: Stripe.Checkout.Session
) {
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 10,
  })
  const errors = checkoutSessionActivationErrors(session, lineItems.data)
  if (errors.length) {
    console.warn(
      `Ignoring Stripe checkout session ${session.id}: ${errors.join(', ')}`
    )
    return false
  }

  const chat = await ChatModel.findOne({ id: session.client_reference_id })
  if (!chat) {
    console.warn(
      `Ignoring Stripe checkout session ${session.id}: chat ${session.client_reference_id} not found`
    )
    return false
  }

  storeStripeActivation(chat, session)
  await chat.save()
  return true
}
