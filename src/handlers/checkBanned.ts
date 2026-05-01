import { NextFunction } from 'grammy'
import Context from '@/models/Context'

export default function checkBanned(ctx: Context, next: NextFunction) {
  if (ctx.dbchat.banned) {
    return ctx.reply(ctx.i18n.t('banned'), {
      disable_web_page_preview: true,
    })
  }
  return next()
}
