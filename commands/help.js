// Dependencies
const { findChat } = require('../helpers/db')
const { checkAdminLock } = require('../helpers/admins')
const { checkDate } = require('../helpers/filter')

/**
 * Setting up help command
 * @param {Telegraf:Bot} bot Bot that should get help setup
 */
function setupHelp(bot) {
  bot.help(async ctx => {
    // Check if less than 5 minutes ago
    if (!checkDate(ctx)) return

    // Get chat
    const chat = await findChat(ctx.chat.id)
    // Check if admin locked
    const adminLockCheck = await checkAdminLock(chat, ctx)
    if (!adminLockCheck) return
    // Setup localizations
    const strings = require('../helpers/strings')()
    strings.setChat(chat)
    // Prepare text
    const text = strings.translate('help')
    // Reply with the message
    ctx.replyWithMarkdown(text, {
      disable_web_page_preview: true,
    })
  })
}

// Exports
module.exports = {
  setupHelp,
}
