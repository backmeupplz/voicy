import { NextFunction } from 'grammy'
import Context from '@/models/Context'

export default function disallowPrivate(ctx: Context, next: NextFunction) {
  if (ctx.chat.type === 'private') {
    return ctx.reply(ctx.i18n.t('error_group'), {
      parse_mode: 'Markdown',
    })
  }
  return next()
}
