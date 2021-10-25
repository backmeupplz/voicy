import { NextFunction } from 'grammy'
import Context from '@/models/Context'

const superAdminId = +process.env.ADMIN_ID
export default function checkSuperAdmin(ctx: Context, next: NextFunction) {
  if (ctx.from.id !== superAdminId) {
    return
  }
  return next()
}
