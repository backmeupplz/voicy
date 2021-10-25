import { NextFunction } from 'grammy'
import Context from '@/models/Context'

export default function checkFilesBanned(ctx: Context, next: NextFunction) {
  if (ctx.dbchat.filesBanned) {
    return
  }
  return next()
}
