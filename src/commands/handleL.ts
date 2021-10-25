import engines from '@/engines'
import EngineRecognizer from '@/helpers/engine/EngineRecognizer'
import sendLanguage from '@/helpers/language/sendLanguage'
import localeCodeForChat from '@/helpers/localeCodeForChat'
import Context from '@/models/Context'

export default async function handleL(ctx: Context) {
  if (ctx.message.text.length <= 2) {
    return sendLanguage(ctx, true)
  }
  const language = ctx.message.text.split(' ')[1]
  if (!language) {
    return sendLanguage(ctx, true)
  }
  const engineObject: EngineRecognizer = engines[ctx.dbchat.engine]
  if (engineObject.languageException) {
    return ctx.reply(ctx.i18n.t(engineObject.languageException))
  }
  const languageObject = engineObject.languages.find((l) =>
    l.code.toLowerCase().includes(language.toLowerCase())
  )
  if (!languageObject) {
    return sendLanguage(ctx, true)
  }
  ctx.dbchat.languages[engineObject.code] = languageObject.code
  await ctx.dbchat.save()
  ctx.i18n.locale(localeCodeForChat(ctx.dbchat))
  return ctx.reply('👍')
}
