import { NextFunction } from 'grammy'
import {
  isTranscribableTelegramFile,
  transcribableMediaFromMessage,
} from '@/helpers/transcribableTelegramMedia'
import Context from '@/models/Context'

export default function checkDocumentType(ctx: Context, next: NextFunction) {
  const file = ctx.msg ? transcribableMediaFromMessage(ctx.msg) : undefined
  if (!file) {
    return
  }
  if (isTranscribableTelegramFile(file)) {
    return next()
  }
}
