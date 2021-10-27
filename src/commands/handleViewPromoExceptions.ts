import { promoExceptions } from '@/models/PromoException'
import Context from '@/models/Context'

export default function handleViewPromoExceptions(ctx: Context) {
  return ctx.reply(promoExceptions.join(', '))
}
