import logAnswerTime from '@/helpers/logAnswerTime'
import Context from '@/models/Context'

export default async function handleGeeky(ctx: Context) {
  await ctx.reply(ctx.i18n.t('geeky'), {
    parse_mode: 'Markdown',
  })
  logAnswerTime(ctx, '/geeky')
}
