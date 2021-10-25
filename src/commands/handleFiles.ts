import logAnswerTime from '@/helpers/logAnswerTime'
import Context from '@/models/Context'

export default async function handleFiles(ctx: Context) {
  ctx.dbchat.filesBanned = !ctx.dbchat.filesBanned
  await ctx.dbchat.save()
  await ctx.reply(
    ctx.i18n.t(ctx.dbchat.filesBanned ? 'files_false' : 'files_true'),
    {
      parse_mode: 'Markdown',
    }
  )
  logAnswerTime(ctx, '/files')
}
