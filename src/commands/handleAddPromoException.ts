import { addPromoException } from '@/models/PromoException'
import Context from '@/models/Context'

export default async function handleAddPromoException(ctx: Context) {
  const id = +ctx.message.text.split(' ')[1]
  if (!id) {
    return ctx.reply('😱')
  }
  await addPromoException(id)
  return ctx.reply('👍')
}
