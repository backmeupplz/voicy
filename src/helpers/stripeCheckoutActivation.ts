import { Chat, ChatModel } from '@/models/Chat'
import { DocumentType } from '@typegoose/typegoose'
import { stripe } from '@/helpers/stripe'
import Stripe from 'stripe'

export const VOICY_STRIPE_PRICE_ID =
  process.env.STRIPE_PRICE_ID || 'price_1LyeHbKXsMRGkVL4i2xZnaZk'
export const VOICY_STRIPE_EXPECTED_AMOUNT = Number(
  process.env.STRIPE_EXPECTED_AMOUNT || process.env.STRIPE_AMOUNT_TOTAL || 699
)
export const VOICY_STRIPE_CURRENCY = (
  process.env.STRIPE_CURRENCY || 'usd'
).toLowerCase()
export const VOICY_STRIPE_METADATA_PURPOSE = 'voicy_chat_activation'

export function requireStripeWebhookSigningSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SIGNING_SECRET
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SIGNING_SECRET is required')
  }
  return secret
}

export function stripeCheckoutMetadata(chatId: string) {
  return {
    voicy_payment_purpose: VOICY_STRIPE_METADATA_PURPOSE,
    voicy_chat_id: chatId,
    voicy_price_id: VOICY_STRIPE_PRICE_ID,
  }
}

function paymentIntentId(session: Stripe.Checkout.Session) {
  const paymentIntent = session.payment_intent
  if (!paymentIntent) {
    return undefined
  }
  return typeof paymentIntent === 'string' ? paymentIntent : paymentIntent.id
}

function lineItemPriceId(lineItem: Stripe.LineItem) {
  const price = lineItem.price
  if (!price || typeof price === 'string') {
    return undefined
  }
  return price.id
}

export function checkoutSessionActivationErrors(
  session: Stripe.Checkout.Session,
  lineItems: Stripe.LineItem[]
) {
  const errors: string[] = []
  const clientReferenceId = session.client_reference_id
  const metadata = session.metadata || {}

  if (!clientReferenceId) {
    errors.push('missing client_reference_id')
  }
  if (session.payment_status !== 'paid') {
    errors.push(`unexpected payment_status ${session.payment_status}`)
  }
  if (session.mode !== 'payment') {
    errors.push(`unexpected mode ${session.mode}`)
  }
  if (session.amount_subtotal !== VOICY_STRIPE_EXPECTED_AMOUNT) {
    errors.push(`unexpected amount_subtotal ${session.amount_subtotal}`)
  }
  if (
    typeof session.amount_total !== 'number' ||
    session.amount_total < VOICY_STRIPE_EXPECTED_AMOUNT
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
  if (metadata.voicy_price_id !== VOICY_STRIPE_PRICE_ID) {
    errors.push('metadata price id mismatch')
  }
  if (
    !lineItems.some(
      (lineItem) =>
        lineItemPriceId(lineItem) === VOICY_STRIPE_PRICE_ID &&
        lineItem.quantity === 1
    )
  ) {
    errors.push('expected Stripe price line item not found')
  }

  return errors
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
  chat.stripePriceId = VOICY_STRIPE_PRICE_ID
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
