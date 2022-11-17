import { NextFunction } from 'grammy'
import Context from '@/models/Context'

export default function checkBanned(ctx: Context, next: NextFunction) {
  if (ctx.dbchat.banned) {
    return ctx.reply(
      'You are banned (most likely for fraud). Contact @borodutch if this is a mistake.'
    )
  }
  return next()
}
