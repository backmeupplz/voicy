import { markChatReachable } from '@/helpers/chatReachability'
import { markdownI18n } from '@/helpers/telegramMarkdown'
import { replyWithPromo } from '@/helpers/promoHost'
import Context from '@/models/Context'
import logAnswerTime from '@/helpers/logAnswerTime'

export default async function sendStart(ctx: Context) {
  await replyWithPromo(ctx, markdownI18n(ctx, 'start'))
  await markChatReachable(ctx, '/start')
  logAnswerTime(ctx, '/start')
}
