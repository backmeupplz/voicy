import EngineRecognizer from '@/helpers/engine/EngineRecognizer'
import Context from '@/models/Context'
import logAnswerTime from '@/helpers/logAnswerTime'
import engines from '@/engines'
import languageKeyboard from '@/helpers/language/languageKeyboard'

export default async function sendLanguage(ctx: Context, isCommand?: boolean) {
  const engineObject: EngineRecognizer = engines[ctx.dbchat.engine]
  const text = isCommand
    ? ctx.i18n.t('language', { engine: engineObject.name })
    : ctx.i18n.t('language_without_engine')
  await ctx.reply(text, {
    reply_markup: languageKeyboard(ctx.dbchat.engine, isCommand),
    reply_to_message_id: ctx.message?.message_id,
  })
  logAnswerTime(ctx, '/language')
}
