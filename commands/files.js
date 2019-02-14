// Dependencies
const { findChat } = require('../helpers/db')
const { checkAdminLock } = require('../helpers/admins')
const { checkDate } = require('../helpers/filter')

/**
 * Setting up files command
 * @param {Telegraf:Bot} bot Bot that should get files setup
 */
function setupFiles(bot) {
  bot.command('files', async (ctx) => {
    // Check if less than 5 minutes ago
    if (!checkDate(ctx)) return

    // Get chat
    let chat = await findChat(ctx.chat.id)
    // Check if admin locked
    const adminLockCheck = await checkAdminLock(chat, ctx)
    if (!adminLockCheck) return
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
    await ctx.replyWithMarkdown(strings.translate(text))
    // Log time
    console.info(`/engine answered in ${(new Date().getTime() - ctx.timeReceived.getTime()) / 1000}s`)
  })
}

// Exports
module.exports = {
  setupFiles,
}
