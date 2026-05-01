import { NextFunction } from 'grammy'
import Context from '@/models/Context'

export default function configureI18n(ctx: Context, next: NextFunction) {
  ctx.i18n.locale(ctx.dbchat.uiLanguage || 'en')
  return next()
}
