// Dependencies
const { sendEngine } = require('../helpers/engine')
const { findChat } = require('../helpers/db')
const { checkAdminLock } = require('../helpers/admins')
const { checkDate } = require('../helpers/filter')

/**
 * Setting up engine command
 * @param {Telegraf:Bot} bot Bot that should get engine setup
 */
function setupEngine(bot) {
  bot.command('engine', async (ctx) => {
    // Check if less than 5 minutes ago
    if (!checkDate(ctx)) return

    // Get chat
    const chat = await findChat(ctx.chat.id)
    // Check if admin locked
    const adminLockCheck = await checkAdminLock(chat, ctx)
    if (!adminLockCheck) return
    // Respond
    sendEngine(ctx)
  })
}

// Exports
module.exports = {
  setupEngine,
}
