import { NextFunction } from 'grammy'
import Context from '@/models/Context'

function localeForChat(chat) {
  const engineObject = engines.find((e) => e.code === chat.engine)
  const language = chat[`${chat.engine}Language`]
  const languageObject =
    engineObject.languages.find((l) => l.code === language) ||
    engineObject.languages.find(
      (l) => l.code === engineObject.defaultLanguageCode
    )
  return languageObject.i18nCode
}

export default function configureI18n(ctx: Context, next: NextFunction) {
  ctx.i18n.locale(ctx.dbchat.language)
  return next()
}
