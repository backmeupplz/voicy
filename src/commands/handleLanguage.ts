import Context from '@/models/Context'
import EngineRecognizer from '@/helpers/engine/EngineRecognizer'
import engines from '@/engines'
import sendLanguage from '@/helpers/language/sendLanguage'

export default function handleLanguage(ctx: Context) {
  const engineObject: EngineRecognizer = engines[ctx.dbchat.engine]
  if (engineObject.languageException) {
    return ctx.reply(ctx.i18n.t(engineObject.languageException), {
      parse_mode: 'Markdown',
    })
  }
  return sendLanguage(ctx, true)
}
