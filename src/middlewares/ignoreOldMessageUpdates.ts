import { NextFunction } from 'grammy'
import Context from '@/models/Context'

const threshold = 5 * 60 // 5 minutes
export default function ignoreOldMessageUpdates(
  ctx: Context,
  next: NextFunction
) {
  // Check if context update type is a message
  if (ctx.message) {
    if (new Date().getTime() / 1000 - ctx.message.date < threshold) {
      return next()
    } else {
      console.log(
        `Ignoring message from ${ctx.from.id} at ${ctx.chat.id} (${
          new Date().getTime() / 1000
        }:${ctx.message.date})`
      )
    }
  } else {
    return next()
  }
}
