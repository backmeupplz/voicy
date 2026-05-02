import { uiLanguageForTelegramCode } from '@/helpers/language/uiLanguages'
import Context from '@/models/Context'

export default function setLanguageCodeFromTelegram(ctx: Context) {
  if (ctx.dbchat.uiLanguageSelectedManually) {
    ctx.i18n.locale(ctx.dbchat.uiLanguage)
    return ctx.dbchat
  }

  ctx.dbchat.uiLanguage = uiLanguageForTelegramCode(ctx.from.language_code).code
  ctx.i18n.locale(ctx.dbchat.uiLanguage)
  return ctx.dbchat.save()
}
