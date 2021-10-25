import Context from '@/models/Context'
import sendLanguage from '@/helpers/language/sendLanguage'
import sendStart from '@/helpers/sendStart'
import setLanguageCodeFromTelegram from '@/helpers/language/setLanguageCodeFromTelegram'

export default async function handleStart(ctx: Context) {
  if (ctx.from && ctx.from.language_code) {
    ctx.dbchat = await setLanguageCodeFromTelegram(ctx)
    return sendStart(ctx)
  }
  return sendLanguage(ctx)
}
