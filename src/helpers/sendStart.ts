import { markChatReachable } from '@/helpers/chatReachability'
import { markdownI18n } from '@/helpers/telegramMarkdown'
import Context from '@/models/Context'
import logAnswerTime from '@/helpers/logAnswerTime'

export default async function sendStart(ctx: Context) {
  await ctx.reply(markdownI18n(ctx, 'start'), {
    parse_mode: 'Markdown',
  })
  await markChatReachable(ctx, '/start')
  logAnswerTime(ctx, '/start')
}
