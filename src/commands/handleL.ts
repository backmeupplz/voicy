import { findUiLanguage } from '@/helpers/language/uiLanguages'
import Context from '@/models/Context'
import sendLanguage from '@/helpers/language/sendLanguage'

export default async function handleL(ctx: Context) {
  if (ctx.message.text.length <= 2) {
    return sendLanguage(ctx, true)
  }
  const language = ctx.message.text.split(' ')[1]
  if (!language) {
    return sendLanguage(ctx, true)
  }
  const languageObject = findUiLanguage(language)
  if (!languageObject) {
    return sendLanguage(ctx, true)
  }
  ctx.dbchat.uiLanguage = languageObject.code
  ctx.dbchat.uiLanguageSelectedManually = true
  await ctx.dbchat.save()
  ctx.i18n.locale(languageObject.code)
  return ctx.reply(
    ctx.i18n.t('language_success', { language: languageObject.name })
  )
}
