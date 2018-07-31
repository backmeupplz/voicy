/**
 * Getting admin ids of a chat
 * @param {Telegraf:Context} ctx Context to make a query
 * @param {Number} chatId ID of the chat to check
 * @returns list of admin ids
 */
async function getAdminIds(ctx, chatId) {
  const admins = await ctx.telegram.getChatAdministrators(chatId)
  return admins.map(v => v.user.id)
}

/**
 * Getting admin usernames of a chat
 * @param {Telegraf:Context} ctx Context to make a query
 * @param {Number} chatId ID of the chat to check
 * @returns list of admin usernames
 */
async function getAdminUsernames(ctx, chatId) {
  const admins = await ctx.telegram.getChatAdministrators(chatId)
  return admins.map(v => v.user.username || 'nousername')
}

/**
 * Checking if ID is user at a chat
 * @param {Telegraf:Context} ctx Context that should make the query
 * @param {Number} chatId Chat that is getting checked
 * @param {Number} userId User that is getting checked for being an admin
 * @returns boolean indicating if user is admin
 */
async function isAdmin(ctx, chatId, userId) {
  const admins = await getAdminIds(ctx, chatId)
  return admins.includes(userId)
}

/**
 * Checking if bot is admin at a chat
 * @param {Telegraf:Context} ctx Context that should make the query
 * @param {Number} chatId Chat that is getting checked
 * @returns boolean indicating if bot is admin
 */
async function isBotAdmin(ctx, chatId) {
  const admins = await getAdminUsernames(ctx, chatId)
  return admins.includes(process.env.USERNAME)
}

/**
 * Middleware to check whether chat is admin locked
 * Deletes message if it's locked and sent not by admin
 * @param {Mongoose:Chat} chat Chat to check
 * @param {Telegraf:Context} ctx Context of the message sent
 * @returns boolean whether everything is ok
 */
async function checkAdminLock(chat, ctx) {
  try {
    if (chat.adminLocked && !ctx.update.channel_post) {
      // Check if user is an admin
      const isUserAdmin = await isAdmin(ctx, chat.id, ctx.from.id)
      if (!isUserAdmin) {
        // Check if bot is admin
        const isBotAdminInChat = await isBotAdmin(ctx, chat.id)
        if (isBotAdminInChat) {
          // Delete sent message
          await ctx.telegram.deleteMessage(chat.id, ctx.message.message_id)
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
module.exports = {
  checkAdminLock,
}
