import logAnswerTime from '@/helpers/logAnswerTime'
import Context from '@/models/Context'

export default async function handleSilent(ctx: Context) {
  ctx.dbchat.silent = !ctx.dbchat.silent
  await ctx.dbchat.save()
  await ctx.reply(
    ctx.i18n.t(ctx.dbchat.silent ? 'silent_true' : 'silent_false')
  )
  logAnswerTime(ctx, '/silent')
}
