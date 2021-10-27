import { NextFunction } from 'grammy'
import Context from '@/models/Context'

export default function checkDocumentType(ctx: Context, next: NextFunction) {
  const file = ctx.msg?.document || ctx.msg?.audio
  if (!file) {
    return
  }
  const mime = file.mime_type
  const allowedMimeTypes = ['audio', 'octet-stream']
  for (const allowedType of allowedMimeTypes) {
    if (mime.includes(allowedType)) {
      return next()
    }
  }
}
