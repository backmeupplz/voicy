// Dependencies
const {
  sendLanguage,
  setLanguageCode,
} = require('../helpers/language/language')
const checkAdminLock = require('../middlewares/adminLock')
const sendStart = require('../helpers/sendStart')

function setupStart(bot) {
  // Start command
  bot.start(checkAdminLock, async ctx => {
    // Check if Telegram gives us language code
    if (ctx.from && ctx.from.language_code) {
      ctx.dbchat = await setLanguageCode(ctx)
      sendStart(ctx)
    } else {
      sendLanguage(ctx)
    }
  })
  // Enter chat
  bot.on('new_chat_members', async ctx => {
    // Check if bot entered the chat
    if (
      ctx.message.new_chat_participant &&
      ctx.message.new_chat_participant.username === bot.options.username
    ) {
      // Send language keyboard
      sendLanguage(ctx)
    }
  })
}

// Exports
module.exports = {
  setupStart,
  sendStart,
}
