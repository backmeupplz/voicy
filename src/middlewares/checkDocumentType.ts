import { NextFunction } from 'grammy'
import Context from '@/models/Context'

export default function checkDocumentType(ctx: Context, next: NextFunction) {
  if (!ctx.msg?.document) {
    return
  }
  const mime = ctx.msg.document.mime_type
  const allowedMimeTypes = ['audio', 'octet-stream']
  for (const allowedType of allowedMimeTypes) {
    if (mime.includes(allowedType)) {
      return next()
    }
  }
}
