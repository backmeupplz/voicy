// Dependencies
const { findChat } = require('../helpers/db')

/**
 * Setting up files command
 * @param {Telegraf:Bot} bot Bot that should get files setup
 */
function setupFiles(bot) {
  bot.command('files', async (ctx) => {
    // Get chat
    let chat = await findChat(ctx.chat.id)
    // Setup localizations
    const strings = require('../helpers/strings')()
    strings.setChat(chat)
    // Reverse files field
    chat.filesBanned = !chat.filesBanned
    // Save chat
    chat = await chat.save()
    // Reply with the new setting
    const text = chat.filesBanned ?
      '📁 Wonderful! *Voicy* will *ignore* all audio files in this chat since now.' :
      '📁 Wonderful! *Voicy* will *try to recognize* all audio files in this chat since now.'
    ctx.replyWithMarkdown(strings.translate(text))
  })
}

// Exports
module.exports = {
  setupFiles,
}
