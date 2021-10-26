import { NextFunction } from 'grammy'
import Context from '@/models/Context'
import engines from '@/engines'

export default function configureI18n(ctx: Context, next: NextFunction) {
  const chat = ctx.dbchat
  const engine = engines[chat.engine]
  const chatLanguage = chat.languages[chat.engine]
  const language = engine.languages.find((l) => l.code === chatLanguage)
  ctx.i18n.locale(language?.i18nCode || engine.defaultLanguageCode)
  return next()
}
