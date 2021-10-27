import { NextFunction } from 'grammy'
import Context from '@/models/Context'
import report from '@/helpers/report'

export default async function checkAdminLock(ctx: Context, next: NextFunction) {
  // If not admin locked or a channel post, continue
  if (!ctx.dbchat.adminLocked || !!ctx.channelPost) {
    return next()
  }
  // Check if from anonymous admin
  if (ctx.from.username === 'GroupAnonymousBot') {
    return next()
  }
  const member = await ctx.getChatMember(ctx.from.id)
  if (['creator', 'administrator'].includes(member.status)) {
    return next()
  } else {
    try {
      await ctx.deleteMessage()
    } catch (err) {
      report(err, { ctx })
    }
  }
}
