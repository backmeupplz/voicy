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
    const text = strings.translate(
      '😎 *Voicy* converts speech to text from any voice messages and audio files (.ogg, .flac, .wav, .mp3) it receives. You can either talk to *Voicy* in the private chat or add it to a group.\n\nIf you want to use this bot in private messages, please, create a private group with anyone and add *Voicy* there. If you want to add *Voicy* to a group chat, please, add it as a participant on the group profile or to the group in the *Voicy* bot profile.\n\n/help — Shows this message 😱\n/engine — Lets you pick a voice recognition engine: wit.ai, Yandex SpeechKit or Google Speech ⚙\n/language — Lets you pick a voice recognition language 📣\n/lock — Toggles lock or unlock of non-admins using commands in group chats 🔑\n/files — Toggles if the bot should attempt to convert audio files or just ignore them 📁\n/silent — Toggles silent mode when no extra messages like `Voice recognition is initiated` are sent 😶\n/google — Set up google credentials for Google Speech 🦆\n\nLike this bot? Leave a review [here](https://telegram.me/storebot?start=voicybot) 👍\n\nAddress any concerns and questions to my creator — @borodutch\\_support 🦄'
    )
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
