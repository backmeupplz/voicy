import { addPromoException } from '@/models/PromoException'
import Context from '@/models/Context'

export default async function handleAddPromoException(ctx: Context) {
  const ids = ctx.message.text.split(' ')[1]
  if (!ids) {
    return ctx.reply('😱')
  }
  for (const id of ids.split(',')) {
    await addPromoException(+id)
  }
  return ctx.reply('👍')
}
