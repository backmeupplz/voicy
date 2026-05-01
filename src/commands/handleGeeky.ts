import { markdownI18n } from '@/helpers/telegramMarkdown'
import Context from '@/models/Context'
import logAnswerTime from '@/helpers/logAnswerTime'

export default async function handleGeeky(ctx: Context) {
  await ctx.reply(markdownI18n(ctx, 'geeky'), {
    parse_mode: 'Markdown',
  })
  logAnswerTime(ctx, '/geeky')
}
