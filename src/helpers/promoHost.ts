import { InlineKeyboardMarkup } from '@grammyjs/types'
import { connection } from 'mongoose'
import { keyboard, markdown, mongoStore, promos } from '@/helpers/promo'
import Context from '@/models/Context'

// Prime Radiant's reply promos in Voicy (promo.ts): only in private replies to
// /start and /help, never in groups, guest mode, transcriptions or payments
export const promoHook = promos(
  'voicy',
  mongoStore(connection.collection('promos'))
)

// A Markdown reply that carries a promo line or button when the user's arm
// has one; recorded once it was sent
export async function replyWithPromo(ctx: Context, text: string) {
  const d =
    ctx.chat?.type === 'private'
      ? await promoHook.decide(
          ctx.from?.id,
          'private',
          ctx.dbchat?.uiLanguage || ctx.from?.language_code
        )
      : null
  await ctx.reply(text + markdown(d?.promo), {
    disable_web_page_preview: true,
    parse_mode: 'Markdown',
    reply_markup: keyboard(d?.promo) as InlineKeyboardMarkup | undefined,
  })
  await promoHook.record(d)
}
