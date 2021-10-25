import logAnswerTime from '@/helpers/logAnswerTime'
import Context from '@/models/Context'

export default async function handleTimecodes(ctx: Context) {
  ctx.dbchat.timecodesEnabled = !ctx.dbchat.timecodesEnabled
  await ctx.dbchat.save()
  await ctx.reply(
    ctx.i18n.t(
      ctx.dbchat.timecodesEnabled ? 'timecodes_true' : 'timecodes_false'
    ),
    {
      parse_mode: 'Markdown',
    }
  )
  logAnswerTime(ctx, '/timecodes')
}
