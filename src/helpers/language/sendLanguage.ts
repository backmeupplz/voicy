import { markChatReachable } from '@/helpers/chatReachability'
import Context from '@/models/Context'
import languageKeyboard from '@/helpers/language/languageKeyboard'
import logAnswerTime from '@/helpers/logAnswerTime'

export default async function sendLanguage(ctx: Context, isCommand?: boolean) {
  await ctx.reply(ctx.i18n.t('language'), {
    reply_markup: languageKeyboard(isCommand),
    reply_to_message_id: ctx.msg?.message_id,
  })
  await markChatReachable(ctx, isCommand ? '/language' : 'sendLanguage')
  logAnswerTime(ctx, '/language')
}
