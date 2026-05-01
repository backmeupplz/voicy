import { NextFunction } from 'grammy'
import { markdownI18n } from '@/helpers/telegramMarkdown'
import Context from '@/models/Context'

export default function disallowPrivate(ctx: Context, next: NextFunction) {
  if (ctx.chat.type === 'private') {
    return ctx.reply(markdownI18n(ctx, 'error_group'), {
      parse_mode: 'Markdown',
    })
  }
  return next()
}
