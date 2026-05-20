import {
  activateTelegramStarsPayment,
  telegramStarsPreCheckoutErrors,
} from '@/helpers/telegramStarsActivation'
import Context from '@/models/Context'

export async function handleTelegramStarsPreCheckout(ctx: Context) {
  const query = ctx.preCheckoutQuery
  if (!query) {
    return
  }
  const errors = await telegramStarsPreCheckoutErrors(query)
  if (errors.length) {
    await ctx.answerPreCheckoutQuery(false, {
      error_message: 'This Voicy Stars invoice is no longer valid.',
    })
    console.warn(
      `Rejected Telegram Stars pre-checkout ${query.id}: ${errors.join(', ')}`
    )
    return
  }
  await ctx.answerPreCheckoutQuery(true)
}

export async function handleTelegramStarsSuccessfulPayment(ctx: Context) {
  const payment = ctx.message?.successful_payment
  if (!payment) {
    return
  }
  await activateTelegramStarsPayment(payment, ctx.from?.id)
}
