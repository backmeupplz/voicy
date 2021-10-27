import Context from '@/models/Context'
import logAnswerTime from '@/helpers/logAnswerTime'

export default async function handleUrl(ctx: Context) {
  await ctx.reply(ctx.i18n.t('url'), {
    parse_mode: 'Markdown',
  })
  logAnswerTime(ctx, '/url')
}
