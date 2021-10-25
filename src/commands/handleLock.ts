import logAnswerTime from '@/helpers/logAnswerTime'
import Context from '@/models/Context'

export default async function handleLock(ctx: Context) {
  ctx.dbchat.adminLocked = !ctx.dbchat.adminLocked
  await ctx.dbchat.save()
  await ctx.reply(
    ctx.i18n.t(ctx.dbchat.adminLocked ? 'lock_true' : 'lock_false'),
    {
      parse_mode: 'Markdown',
    }
  )
  logAnswerTime(ctx, '/lock')
}
