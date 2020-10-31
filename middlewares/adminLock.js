async function getAdminIds(ctx, chatId) {
  const admins = await ctx.telegram.getChatAdministrators(chatId)
  return admins.map(v => v.user.id)
}

async function getAdminUsernames(ctx, chatId) {
  const admins = await ctx.telegram.getChatAdministrators(chatId)
  return admins.map(v => v.user.username || 'nousername')
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
      // Check if anonymous admin
      if (
        ctx.from &&
        ctx.from.username &&
        ctx.from.username === 'GroupAnonymousBot'
      ) {
        return true
      }
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

// Exports
module.exports = async function checkAdminLock(ctx, next) {
  if (await passesAdminLock(ctx)) {
    next()
  }
}
