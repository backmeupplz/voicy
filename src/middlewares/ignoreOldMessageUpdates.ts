import { NextFunction } from 'grammy'
import {
  logIgnoredTelegramMessage,
  shouldIgnoreTelegramMessageUpdate,
} from '@/helpers/staleTelegramUpdates'
import Context from '@/models/Context'

export default function ignoreOldMessageUpdates(
  ctx: Context,
  next: NextFunction
) {
  if (ctx.message) {
    const decision = shouldIgnoreTelegramMessageUpdate(ctx.message)
    if (decision.ignore) {
      logIgnoredTelegramMessage(ctx, decision)
      return undefined
    }
  }
  return next()
}
