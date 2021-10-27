import { NextFunction } from 'grammy'
import { appendFile } from 'fs'
import Context from '@/models/Context'

function recordDate(ctx: Context) {
  if (!ctx.update.message) {
    return
  }
  appendFile(
    `${__dirname}/../../updates.log`,
    `\n${Math.floor(Date.now() / 1000)} — ${ctx.update.update_id} — ${
      Math.floor(Date.now() / 1000) - ctx.update.message.date
    }s`,
    (err) => {
      if (err) {
        console.error(err)
      }
    }
  )
}

export default function recordTimeReceived(ctx: Context, next: NextFunction) {
  ctx.timeReceived = new Date()
  recordDate(ctx)
  return next()
}
