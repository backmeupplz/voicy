import logAnswerTime from '@/helpers/logAnswerTime'
import Context from '@/models/Context'

export default async function handleUrl(ctx: Context) {
  await ctx.reply(ctx.i18n.t('url'), {
    parse_mode: 'Markdown',
  })
  logAnswerTime(ctx, '/url')
}
