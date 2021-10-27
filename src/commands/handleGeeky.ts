import Context from '@/models/Context'
import logAnswerTime from '@/helpers/logAnswerTime'

export default async function handleGeeky(ctx: Context) {
  await ctx.reply(ctx.i18n.t('geeky'), {
    parse_mode: 'Markdown',
  })
  logAnswerTime(ctx, '/geeky')
}
