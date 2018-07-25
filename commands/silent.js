// Dependencies
const { findChat } = require('../helpers/db')

/**
 * Setting up silent command
 * @param {Telegraf:Bot} bot Bot that should get silent setup
 */
function setupSilent(bot) {
  bot.command('silent', async (ctx) => {
    // Get chat
    let chat = await findChat(ctx.chat.id)
    // Setup localizations
    const strings = require('../helpers/strings')()
    strings.setChat(chat)
    // Reverse silent
    chat.silent = !chat.silent
    // Save chat
    chat = await chat.save()
    // Send new setting
    const text = chat.silent ?
      '😶 Magnificent! *Voicy* will now work in *silent mode*: it will not send any messages to the chat except for the actual voice transcriptions.' :
      '😏 Magnificent! *Voicy* will now work in *usual mode*: it will send `Voice recognition is initiated` messages right after it receives voice messages.'
    await ctx.replyWithMarkdown(strings.translate(text))
  })
}

// Exports
module.exports = {
  setupSilent,
}
