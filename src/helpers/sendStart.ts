import Context from '@/models/Context'
import logAnswerTime from '@/helpers/logAnswerTime'

export default async function sendStart(ctx: Context) {
  await ctx.reply(ctx.i18n.t('start'), {
    parse_mode: 'Markdown',
  })
  logAnswerTime(ctx, '/start')
}
