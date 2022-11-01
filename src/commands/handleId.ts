import Context from '@/models/Context'
import logAnswerTime from '@/helpers/logAnswerTime'

export default async function handleId(ctx: Context) {
  await ctx.reply(`\`${ctx.chat.id}\``, {
    parse_mode: 'Markdown',
  })
  logAnswerTime(ctx, '/id')
}
