import { stripe } from '@/helpers/stripe'
import Context from '@/models/Context'
import logAnswerTime from '@/helpers/logAnswerTime'

export default async function handleDonate(ctx: Context) {
  console.log('/donate called', !!ctx.dbchat.paid)
  if (ctx.dbchat.paid) {
    await ctx.reply(ctx.i18n.t('already_paid'), {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    })
  } else {
    try {
      console.log('Not paid, sending typing action')
      await ctx.api.sendChatAction(ctx.dbchat.id, 'typing')
      console.log('Not paid, creating session')
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price: 'price_1LyeHbKXsMRGkVL4i2xZnaZk',
            quantity: 1,
          },
        ],
        success_url: 'https://t.me/voicybot',
        cancel_url: 'https://t.me/voicybot',
        client_reference_id: `${ctx.dbchat.id}`,
        mode: 'payment',
        allow_promotion_codes: true,
        automatic_tax: {
          enabled: true,
        },
      })
      console.log('Not paid, sending message')
      await ctx.reply(ctx.i18n.t('pay'), {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: ctx.i18n.t('pay_button'),
                url: session.url,
              },
            ],
          ],
        },
      })
    } catch (error) {
      console.log('error sending checkout', error)
    }
  }
  logAnswerTime(ctx, '/donate')
}
