// Dependencies
const { sendLanguage, setLanguageCode } = require('../helpers/language')
const logAnswerTime = require('../helpers/logAnswerTime')
const checkAdminLock = require('../middlewares/adminLock')

function setupStart(bot) {
  // Start command
  bot.start(checkAdminLock, async ctx => {
    // Check if Telegram gives us language code
    if (ctx.from && ctx.from.language_code) {
      ctx.dbchat = await setLanguageCode(ctx, ctx.from.language_code)
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

async function sendStart(ctx) {
  await ctx.replyWithMarkdown(ctx.i18n.t('start'))
  logAnswerTime(ctx, '/start')
}

// Exports
module.exports = {
  setupStart,
  sendStart,
}
