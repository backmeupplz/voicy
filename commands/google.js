// Dependencies
const { findChat } = require('../helpers/db')
const { checkAdminLock } = require('../helpers/admins')
const { fileUrl } = require('../helpers/url')
const download = require('download')

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
    const msg = await ctx.replyWithMarkdown(strings.translate('Reply to this message with the Google Cloud credentials file (.json) to setup Google Speech voice recognition. Not sure what is this and how to get it? Check out [our quick tutorial](https://google.com).'))
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
    try {
      // Get messahe
      const msg = ctx.message || ctx.channelPost
      // Check if reply to bot
      if (msg &&
        msg.reply_to_message &&
        msg.reply_to_message.from.username === process.env.USERNAME) {
        // Get chat
        const chat = await findChat(ctx.chat.id)
        // Check if reply to setup message
        if (chat.googleSetupMessageId &&
          chat.googleSetupMessageId === msg.reply_to_message.message_id) {
          // Setup localizations
          const strings = require('../helpers/strings')()
          strings.setChat(chat)
          // Check if document
          if (!msg.document) {
            await ctx.reply(strings.translate('Sorry, you should reply with a credentials document.'))
            throw new Error()
          }
          // Check mime type
          if (!msg.document.mime_type || msg.document.mime_type !== 'text/plain') {
            await ctx.reply(strings.translate('Sorry, document\'s mime type should be \'text/plain\'.'))
            throw new Error()
          }
          // Download the file
          const fileData = await ctx.telegram.getFile(msg.document.file_id)
          const url = await fileUrl(fileData.file_path)
          // Download credentials file
          const data = await download(url)
          // Save to chat
          chat.googleKey = data.toString('utf8')
          await chat.save()
          // Reply with confirmation
          await ctx.replyWithMarkdown(strings.translate('Congratualations! *Voicy* got the credentials file for the *$[1]* Google Cloud Project. Now you are able to use Google Speech recognition.', JSON.parse(chat.googleKey).project_id))
        }
      }
    } catch (err) {
      // Do nothing
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
