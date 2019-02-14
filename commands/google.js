// Dependencies
const { findChat } = require('../helpers/db')
const { checkAdminLock } = require('../helpers/admins')
const { fileUrl } = require('../helpers/url')
const download = require('download')
const { checkDate } = require('../helpers/filter')
const report = require('../helpers/report')

/**
 * Setting up google command
 * @param {Telegraf:Bot} bot Bot that should get google setup
 */
function setupGoogle(bot) {
  bot.command('google', async ctx => {
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
    // Send message
    const msg = await ctx.replyWithMarkdown(
      strings.translate(
        'Reply to this message with the Google Cloud credentials file (.json) to set up Google Speech voice recognition. Not sure what is this and how to get it? Check out [our quick tutorial](https://medium.com/@nikitakolmogorov/setting-up-google-speech-for-voicybot-b806545750f8).'
      )
    )
    // Save msg to chat
    chat.googleSetupMessageId = msg.message_id
    chat.save()
    // Log time
    console.info(`/google answered in ${(new Date().getTime() - ctx.timeReceived.getTime()) / 1000}s`)
  })
}

/**
 * Setting up checking for google credentials
 * @param {Telegraf:Bot} bot Bot that should get check setup
 */
function setupCheckingCredentials(bot) {
  bot.use(async (ctx, next) => {
    // Continue
    next()
    // Check credentials
    try {
      // Get message
      const msg = ctx.message || ctx.update.channel_post
      // Check if reply to bot
      if (
        msg &&
        msg.reply_to_message &&
        msg.reply_to_message.from &&
        msg.reply_to_message.from.username === process.env.USERNAME
      ) {
        // Get chat
        const chat = await findChat(ctx.chat.id)
        // Check if reply to setup message
        if (
          chat.googleSetupMessageId &&
          chat.googleSetupMessageId === msg.reply_to_message.message_id
        ) {
          // Setup localizations
          const strings = require('../helpers/strings')()
          strings.setChat(chat)
          // Check if document
          if (!msg.document) {
            return ctx.reply(
              strings.translate(
                'Sorry, you should reply with a credentials document.'
              )
            )
          }
          // Check file name
          if (
            !msg.document.file_name ||
            (msg.document.file_name.indexOf('json') < 0 &&
              msg.document.file_name.indexOf('txt') < 0)
          ) {
            return ctx.reply(
              strings.translate(
                "Sorry, document's mime type should be 'text/plain'."
              )
            )
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
          await ctx.replyWithMarkdown(
            strings.translate(
              'Congratulations! *Voicy* got the credentials file for the *$[1]* Google Cloud Project. Now you are able to use Google Speech recognition.',
              JSON.parse(chat.googleKey).project_id
            )
          )
          // Log time
          console.info(`credentials check answered in ${(new Date().getTime() - ctx.timeReceived.getTime()) / 1000}s`)
        }
      }
    } catch (err) {
      report(bot, err, 'setupCheckingCredentials')
    }
  })
}

// Exports
module.exports = {
  setupGoogle,
  setupCheckingCredentials,
}
