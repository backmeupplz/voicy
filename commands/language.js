// Dependencies
const { sendLanguage } = require('../helpers/language')
const { findChat } = require('../helpers/db')
const { checkAdminLock } = require('../helpers/admins')
const { checkDate } = require('../helpers/filter')

/**
 * Setting up language command
 * @param {Telegraf:Bot} bot Bot that should get language setup
 */
function setupLanguage(bot) {
  bot.command('language', async (ctx) => {
    // Check if less than 5 minutes ago
    if (!checkDate(ctx)) return

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
