import { NextFunction } from 'grammy'
import Context from '@/models/Context'

export default function configureI18n(ctx: Context, next: NextFunction) {
  ctx.i18n.locale(ctx.dbchat.languages[ctx.dbchat.engine])
  return next()
}
