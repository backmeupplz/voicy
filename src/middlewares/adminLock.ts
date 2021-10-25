import { NextFunction } from 'grammy'
import Context from '@/models/Context'
import report from '@/helpers/report'

async function getAdminIds(ctx, chatId) {
  const admins = await ctx.telegram.getChatAdministrators(chatId)
  return admins.map((v) => v.user.id)
}

async function getAdminUsernames(ctx, chatId) {
  const admins = await ctx.telegram.getChatAdministrators(chatId)
  return admins.map((v) => v.user.username || 'nousername')
}

async function isAdmin(ctx, chatId, userId) {
  const admins = await getAdminIds(ctx, chatId)
  return admins.includes(userId)
}

async function isBotAdmin(ctx, chatId) {
  const admins = await getAdminUsernames(ctx, chatId)
  return admins.includes(process.env.USERNAME)
}

async function passesAdminLock(ctx) {
  try {
    if (ctx.dbchat.adminLocked && !ctx.update.channel_post) {
      // Check if user is an admin
      const isUserAdmin = await isAdmin(ctx, ctx.dbchat.id, ctx.from.id)
      if (!isUserAdmin) {
        // Check if bot is admin
        const isBotAdminInChat = await isBotAdmin(ctx, ctx.dbchat.id)
        if (isBotAdminInChat) {
          // Delete sent message
          await ctx.telegram.deleteMessage(
            ctx.dbchat.id,
            ctx.message.message_id
          )
        }
        // Halt execution
        return false
      }
    }
    return true
  } catch (err) {
    return false
  }
}

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
