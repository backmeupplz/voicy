import { stripe } from '@/helpers/stripe'
import Context from '@/models/Context'
import logAnswerTime from '@/helpers/logAnswerTime'

export default async function handlePay(ctx: Context) {
  if (ctx.dbchat.paid) {
    await ctx.reply(ctx.i18n.t('already_paid'), {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    })
  } else {
    try {
      await ctx.api.sendChatAction(ctx.dbchat.id, 'typing')
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
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
      })
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
  logAnswerTime(ctx, '/pay')
}
