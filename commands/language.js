// Dependencies
const { sendLanguage } = require('../helpers/language')
const { findChat } = require('../helpers/db')
const { checkAdminLock } = require('../helpers/admins')

/**
 * Setting up language command
 * @param {Telegraf:Bot} bot Bot that should get language setup
 */
function setupLanguage(bot) {
  bot.command('language', async (ctx) => {
    // Get chat
    const chat = await findChat(ctx.chat.id)
    // Check if admin locked
    const adminLockCheck = await checkAdminLock(chat, ctx)
    if (!adminLockCheck) return
    sendLanguage(ctx, true)
  })
}

// Exports
module.exports = {
  setupLanguage,
}
