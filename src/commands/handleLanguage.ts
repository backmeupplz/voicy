import Context from '@/models/Context'
import sendLanguage from '@/helpers/language/sendLanguage'

export default function handleLanguage(ctx: Context) {
  return sendLanguage(ctx, true)
}
