import {
  VOICY_STRIPE_FIXED_AMOUNTS,
  VOICY_STRIPE_MINIMUM_AMOUNT,
  formatStripeDonationAmount,
  parseStripeDonationAmount,
  stripeCheckoutSessionRequest,
  stripeDonationOption,
} from '@/helpers/stripeCheckoutActivation'
import { htmlI18n, markdownI18n } from '@/helpers/telegramMarkdown'
import { stripe } from '@/helpers/stripe'
import Context from '@/models/Context'
import Stripe from 'stripe'
import logAnswerTime from '@/helpers/logAnswerTime'

function commandAmountInput(ctx: Context) {
  const match = (ctx as Context & { match?: string }).match
  if (typeof match === 'string' && match.trim()) {
    return match
  }
  return ctx.message?.text?.replace(/^\/donate(?:@\w+)?\s*/i, '')
}

function createCheckoutSession(chatId: string, amount: number) {
  return stripe.checkout.sessions.create(
    stripeCheckoutSessionRequest(chatId, stripeDonationOption(amount))
  )
}

function checkoutButton(
  ctx: Context,
  session: Stripe.Response<Stripe.Checkout.Session>,
  amount: number
) {
  return {
    text: ctx.i18n.t('pay_button', {
      amount: formatStripeDonationAmount(amount),
    }),
    url: session.url,
  }
}

export default async function handleDonate(ctx: Context) {
  console.log('/donate called', !!ctx.dbchat.paid)
  if (ctx.dbchat.paid) {
    await ctx.reply(markdownI18n(ctx, 'already_paid'), {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    })
  } else {
    try {
      console.log('Not paid, sending typing action')
      await ctx.api.sendChatAction(ctx.dbchat.id, 'typing')
      const chatId = `${ctx.dbchat.id}`
      const requestedAmount = parseStripeDonationAmount(commandAmountInput(ctx))
      if (
        typeof requestedAmount === 'number' &&
        requestedAmount < VOICY_STRIPE_MINIMUM_AMOUNT
      ) {
        await ctx.reply(
          htmlI18n(ctx, 'pay_amount_too_low', {
            amount: formatStripeDonationAmount(VOICY_STRIPE_MINIMUM_AMOUNT),
          }),
          {
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }
        )
        return
      }
      if (typeof requestedAmount === 'number') {
        console.log('Not paid, creating custom donation session')
        const session = await createCheckoutSession(chatId, requestedAmount)
        await ctx.reply(
          htmlI18n(ctx, 'pay_custom', {
            amount: formatStripeDonationAmount(requestedAmount),
          }),
          {
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: {
              inline_keyboard: [
                [checkoutButton(ctx, session, requestedAmount)],
              ],
            },
          }
        )
        return
      }
      console.log('Not paid, creating fixed donation sessions')
      const sessions = await Promise.all(
        VOICY_STRIPE_FIXED_AMOUNTS.map((amount) =>
          createCheckoutSession(chatId, amount)
        )
      )
      console.log('Not paid, sending message')
      await ctx.reply(htmlI18n(ctx, 'pay'), {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: sessions.map((session, index) => [
            checkoutButton(ctx, session, VOICY_STRIPE_FIXED_AMOUNTS[index]),
          ]),
        },
      })
    } catch (error) {
      console.log('error sending checkout', error)
      await ctx.reply(markdownI18n(ctx, 'error_donation_checkout'), {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      })
    }
  }
  logAnswerTime(ctx, '/donate')
}
