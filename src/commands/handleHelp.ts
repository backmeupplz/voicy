import { markChatReachable } from '@/helpers/chatReachability'
import { markdownI18n } from '@/helpers/telegramMarkdown'
import { replyWithPromo } from '@/helpers/promoHost'
import Context from '@/models/Context'
import logAnswerTime from '@/helpers/logAnswerTime'

export default async function handleHelp(ctx: Context) {
  await replyWithPromo(ctx, markdownI18n(ctx, 'help'))
  await markChatReachable(ctx, '/help')
  logAnswerTime(ctx, '/help')
}
