// Dependencies
const { findChat } = require('../helpers/db')
const { checkAdminLock } = require('../helpers/admins')

/**
 * Setting up google command
 * @param {Telegraf:Bot} bot Bot that should get google setup
 */
function setupGoogle(bot) {
  bot.command('google', async (ctx) => {
    // Get chat
    const chat = await findChat(ctx.chat.id)
    // Check if admin locked
    const adminLockCheck = await checkAdminLock(chat, ctx)
    if (!adminLockCheck) return
    // Setup localizations
    const strings = require('../helpers/strings')()
    strings.setChat(chat)
    // Send message
    const msg = await ctx.replyWithMarkdown(strings.translate('Reply to this message with the following things to setup Google Speech voice recognition:\n\n1. Google Cloud credentials file (.json)\n2. Google Cloud app name\n\nNot sure what are those and how to make it work? Check out [our quick tutorial](https://google.com).'))
    // Save msg to chat
    chat.googleSetupMessageId = msg.message_id
    chat.save()
  })
}

/**
 * Setting up checking for google credentials
 * @param {Telegraf:Bot} bot Bot that should get check setup
 */
function setupCheckingCredentials(bot) {
  bot.use(async (ctx, next) => {
    // Get messahe
    const msg = ctx.message || ctx.channelPost
    // Check if reply to bot
    if (msg && msg.reply_to_message && msg.reply_to_message.from.username === process.env.USERNAME) {
      // Get chat
      const chat = await findChat(ctx.chat.id)
      // Check if reply to setup message
      if (chat.googleSetupMessageId && chat.googleSetupMessageId === msg.reply_to_message.message_id) {
        
      }
    }
    // Continue
    next()
  })
}

// Exports
module.exports = {
  setupGoogle,
  setupCheckingCredentials,
}
