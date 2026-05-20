import { Chat, ChatModel } from '@/models/Chat'
import { DocumentType } from '@typegoose/typegoose'
import { SuccessfulPayment } from '@grammyjs/types'
import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { escapeTelegramMarkdownText } from '@/helpers/telegramMarkdown'
import bot from '@/helpers/bot'
import i18n from '@/helpers/i18n'

const PAYLOAD_VERSION = 'v1'
const PAYLOAD_PURPOSE = 'ca'
const FIXED_TIER = 'f'
const CUSTOM_TIER = 'c'
const SIGNATURE_BYTES = 16
const NONCE_BYTES = 12
const MAX_TELEGRAM_PAYLOAD_BYTES = 128

export const TELEGRAM_STARS_CURRENCY = 'XTR'
export const TELEGRAM_STARS_PROVIDER_TOKEN = ''
export const VOICY_TELEGRAM_STARS_MINIMUM_AMOUNT = Number(
  process.env.TELEGRAM_STARS_MINIMUM_AMOUNT || 100
)
export const VOICY_TELEGRAM_STARS_FIXED_AMOUNTS = (
  process.env.TELEGRAM_STARS_FIXED_AMOUNTS || '100,250,500,1000'
)
  .split(',')
  .map((amount) => Number(amount.trim()))
  .filter(
    (amount) =>
      Number.isInteger(amount) && amount >= VOICY_TELEGRAM_STARS_MINIMUM_AMOUNT
  )

export type TelegramStarsDonationTier = 'fixed' | 'custom'

export interface TelegramStarsDonationOption {
  amount: number
  tier: TelegramStarsDonationTier
}

export interface TelegramStarsPayloadMetadata {
  version: typeof PAYLOAD_VERSION
  purpose: typeof PAYLOAD_PURPOSE
  chatId: string
  amount: number
  tier: TelegramStarsDonationTier
  nonce: string
}

export interface TelegramStarsInvoiceLinkRequest {
  title: string
  description: string
  payload: string
  provider_token: string
  currency: typeof TELEGRAM_STARS_CURRENCY
  prices: Array<{ label: string; amount: number }>
}

export interface TelegramStarsInvoiceApi {
  raw: {
    createInvoiceLink(request: TelegramStarsInvoiceLinkRequest): Promise<string>
  }
}

export interface TelegramStarsPaymentLike {
  currency: string
  total_amount: number
  invoice_payload: string
  telegram_payment_charge_id: string
}

export interface TelegramStarsPreCheckoutLike {
  currency: string
  total_amount: number
  invoice_payload: string
}

function base64url(buffer: Buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function payloadSecret() {
  const secret = process.env.TELEGRAM_STARS_PAYLOAD_SECRET || process.env.TOKEN
  if (!secret) {
    throw new Error('TELEGRAM_STARS_PAYLOAD_SECRET or TOKEN is required')
  }
  return secret
}

function signature(body: string) {
  return base64url(
    createHmac('sha256', payloadSecret())
      .update(body)
      .digest()
      .subarray(0, SIGNATURE_BYTES)
  )
}

function verifySignature(body: string, actualSignature: string) {
  const expected = Buffer.from(signature(body))
  const actual = Buffer.from(actualSignature)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function tierCode(tier: TelegramStarsDonationTier) {
  return tier === 'fixed' ? FIXED_TIER : CUSTOM_TIER
}

function tierFromCode(tier: string) {
  if (tier === FIXED_TIER) {
    return 'fixed'
  }
  if (tier === CUSTOM_TIER) {
    return 'custom'
  }
  return undefined
}

export function formatTelegramStarsDonationAmount(amount: number) {
  return `${amount} Stars`
}

export function telegramStarsDonationOption(
  amount: number
): TelegramStarsDonationOption {
  if (
    !Number.isInteger(amount) ||
    amount < VOICY_TELEGRAM_STARS_MINIMUM_AMOUNT
  ) {
    throw new Error(
      `Stars donation amount must be at least ${VOICY_TELEGRAM_STARS_MINIMUM_AMOUNT}`
    )
  }
  return {
    amount,
    tier: VOICY_TELEGRAM_STARS_FIXED_AMOUNTS.includes(amount)
      ? 'fixed'
      : 'custom',
  }
}

export function createTelegramStarsInvoicePayload(
  chatId: string,
  donation: TelegramStarsDonationOption,
  nonce = base64url(randomBytes(NONCE_BYTES))
) {
  const body = [
    PAYLOAD_VERSION,
    PAYLOAD_PURPOSE,
    chatId,
    donation.amount,
    tierCode(donation.tier),
    nonce,
  ].join('|')
  const payload = `${body}|${signature(body)}`
  if (Buffer.byteLength(payload, 'utf8') > MAX_TELEGRAM_PAYLOAD_BYTES) {
    throw new Error('Telegram Stars invoice payload exceeds 128 bytes')
  }
  return payload
}

export function parseTelegramStarsInvoicePayload(
  payload: string
): TelegramStarsPayloadMetadata | undefined {
  const parts = payload.split('|')
  if (parts.length !== 7) {
    return undefined
  }
  const [version, purpose, chatId, rawAmount, rawTier, nonce, rawSignature] =
    parts
  const amount = Number(rawAmount)
  const tier = tierFromCode(rawTier)
  const body = parts.slice(0, 6).join('|')
  if (
    version !== PAYLOAD_VERSION ||
    purpose !== PAYLOAD_PURPOSE ||
    !/^-?\d+$/.test(chatId) ||
    !Number.isInteger(amount) ||
    !tier ||
    !nonce ||
    !rawSignature ||
    !verifySignature(body, rawSignature)
  ) {
    return undefined
  }
  return {
    version,
    purpose,
    chatId,
    amount,
    tier,
    nonce,
  }
}

export function telegramStarsInvoiceLinkRequest(
  chatId: string,
  donation: TelegramStarsDonationOption,
  copy: { title: string; description: string; label: string },
  nonce?: string
): TelegramStarsInvoiceLinkRequest {
  return {
    title: copy.title,
    description: copy.description,
    payload: createTelegramStarsInvoicePayload(chatId, donation, nonce),
    provider_token: TELEGRAM_STARS_PROVIDER_TOKEN,
    currency: TELEGRAM_STARS_CURRENCY,
    prices: [
      {
        label: copy.label,
        amount: donation.amount,
      },
    ],
  }
}

export function createTelegramStarsInvoiceLink(
  api: TelegramStarsInvoiceApi,
  chatId: string,
  donation: TelegramStarsDonationOption,
  copy: { title: string; description: string; label: string }
) {
  return api.raw.createInvoiceLink(
    telegramStarsInvoiceLinkRequest(chatId, donation, copy)
  )
}

export function telegramStarsPaymentValidationErrors(
  payment: TelegramStarsPreCheckoutLike
) {
  const errors: string[] = []
  const metadata = parseTelegramStarsInvoicePayload(payment.invoice_payload)
  if (!metadata) {
    errors.push('invalid signed invoice payload')
    return errors
  }
  if (payment.currency !== TELEGRAM_STARS_CURRENCY) {
    errors.push(`unexpected currency ${payment.currency}`)
  }
  if (payment.total_amount !== metadata.amount) {
    errors.push(`unexpected total_amount ${payment.total_amount}`)
  }
  if (metadata.amount < VOICY_TELEGRAM_STARS_MINIMUM_AMOUNT) {
    errors.push(`Stars amount below minimum ${metadata.amount}`)
  }
  if (
    metadata.tier === 'fixed' &&
    !VOICY_TELEGRAM_STARS_FIXED_AMOUNTS.includes(metadata.amount)
  ) {
    errors.push(`unexpected fixed Stars amount ${metadata.amount}`)
  }
  return errors
}

export async function telegramStarsPreCheckoutErrors(
  query: TelegramStarsPreCheckoutLike
) {
  const errors = telegramStarsPaymentValidationErrors(query)
  const metadata = parseTelegramStarsInvoicePayload(query.invoice_payload)
  if (!metadata) {
    return errors
  }
  const chat = await ChatModel.findOne({ id: metadata.chatId })
  if (!chat) {
    errors.push(`target chat ${metadata.chatId} not found`)
  } else if (chat.paid) {
    errors.push(`target chat ${metadata.chatId} is already activated`)
  }
  return errors
}

function storeTelegramStarsActivation(
  chat: DocumentType<Chat>,
  payment: TelegramStarsPaymentLike,
  metadata: TelegramStarsPayloadMetadata,
  payerUserId?: number | string
) {
  chat.paid = true
  chat.telegramPaymentChargeId = payment.telegram_payment_charge_id
  chat.telegramStarsPaidAt = new Date()
  chat.telegramStarsAmount = metadata.amount
  chat.telegramStarsDonationTier = metadata.tier
  chat.telegramStarsPayerUserId =
    payerUserId === undefined ? undefined : `${payerUserId}`
}

export function telegramStarsActivationConfirmationText(
  chat: Pick<Chat, 'uiLanguage'>
) {
  return escapeTelegramMarkdownText(
    i18n.t(chat.uiLanguage || 'en', 'telegram_stars_activation_confirmed')
  )
}

export async function sendTelegramStarsActivationConfirmation(
  chat: Pick<Chat, 'id' | 'uiLanguage'>
) {
  try {
    await bot.api.sendMessage(
      chat.id,
      telegramStarsActivationConfirmationText(chat),
      {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }
    )
  } catch (error) {
    const errorDetails =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : 'Unknown Telegram send error'
    console.warn(
      `Failed to send Telegram Stars activation confirmation to chat ${chat.id}: ${errorDetails}`
    )
  }
}

export async function activateTelegramStarsPayment(
  payment: SuccessfulPayment | TelegramStarsPaymentLike,
  payerUserId?: number | string
) {
  const errors = telegramStarsPaymentValidationErrors(payment)
  if (errors.length) {
    console.warn(
      `Ignoring Telegram Stars payment ${
        payment.telegram_payment_charge_id
      }: ${errors.join(', ')}`
    )
    return false
  }
  const metadata = parseTelegramStarsInvoicePayload(payment.invoice_payload)
  if (!metadata) {
    return false
  }
  const chat = await ChatModel.findOne({ id: metadata.chatId })
  if (!chat) {
    console.warn(
      `Ignoring Telegram Stars payment ${payment.telegram_payment_charge_id}: chat ${metadata.chatId} not found`
    )
    return false
  }
  if (chat.telegramPaymentChargeId === payment.telegram_payment_charge_id) {
    return true
  }

  const wasAlreadyPaid = chat.paid
  storeTelegramStarsActivation(chat, payment, metadata, payerUserId)
  await chat.save()
  if (!wasAlreadyPaid) {
    await sendTelegramStarsActivationConfirmation(chat)
  }
  return true
}
