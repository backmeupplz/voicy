import { ChatModel } from '@/models/Chat'
import Context from '@/models/Context'

export default async function handleEnableGoogle(ctx: Context) {
  const sender = await ChatModel.findOne({ id: `${ctx.from.id}` })
  if (!sender.googleKey) {
    return ctx.reply(ctx.i18n.t('google_enable_personal_not_setup'), {
      parse_mode: 'Markdown',
    })
  }
  ctx.dbchat.googleKey = sender.googleKey
  await ctx.dbchat.save()
  return ctx.reply(ctx.i18n.t('google_enable_success'), {
    parse_mode: 'Markdown',
  })
}
