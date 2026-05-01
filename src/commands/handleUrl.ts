import { markdownI18n } from '@/helpers/telegramMarkdown'
import Context from '@/models/Context'
import logAnswerTime from '@/helpers/logAnswerTime'

export default async function handleUrl(ctx: Context) {
  await ctx.reply(markdownI18n(ctx, 'url'), {
    parse_mode: 'Markdown',
  })
  logAnswerTime(ctx, '/url')
}
