// import { promoExceptions } from '@/models/PromoException'
import Context from '@/models/Context'
// import isRuChat from '@/helpers/isRuChat'
// import promoTexts from '@/helpers/promoTexts'

export default function addPromoToText(ctx: Context, text: string) {
  // return promoExceptions.includes(+ctx.dbchat.id)
  //   ? text
  //   : `${text}\n${isRuChat(ctx.dbchat) ? promoTexts.ru() : promoTexts.en()}`
  return text
}
