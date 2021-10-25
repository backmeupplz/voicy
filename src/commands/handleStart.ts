import sendLanguage from '@/helpers/language/sendLanguage'
import setLanguageCodeFromTelegram from '@/helpers/language/setLanguageCodeFromTelegram'
import sendStart from '@/helpers/sendStart'
import Context from '@/models/Context'

export default async function handleStart(ctx: Context) {
  if (ctx.from && ctx.from.language_code) {
    ctx.dbchat = await setLanguageCodeFromTelegram(ctx)
    return sendStart(ctx)
  }
  return sendLanguage(ctx)
}
