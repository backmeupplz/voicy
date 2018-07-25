// Dependencies
const { findChat } = require('../helpers/db')
const { sendLanguage, setLanguageCode } = require('../helpers/language')

/**
 * Setting up start command
 * @param {Telegraf:Bot} bot Bot that should get start setup
 */
function setupStart(bot) {
  // Start command
  bot.start(async (ctx) => {
    // Get chat
    let chat = await findChat(ctx.chat.id)
    // Check if Telegram gives us language code
    if (ctx.from.language_code) {
      // Set language code to the chat
      chat = await setLanguageCode(chat, ctx.from.language_code)
      sendStart(ctx, chat)
    } else {
      sendLanguage(bot, chat)
    }
  })
  // Enter chat
  bot.on('new_chat_members', async (ctx) => {
    if (ctx.message.new_chat_participant &&
      ctx.message.new_chat_participant.username === process.env.USERNAME) {
      // Get chat
      const chat = await findChat(ctx.chat.id)
      // Send language keyboard
      sendLanguage(bot, chat)
    }
  })
}

/**
 * Sends start message
 * @param {Telegraf:Context} ctx Context to respond
 * @param {Mongoose:Chat} chat Relevant chat
 */
function sendStart(ctx, chat) {
  // Get localization strings and set it up
  const strings = require('../helpers/strings')()
  strings.setChat(chat)
  // Send start message
  const text = strings.translate('👋 Hello there! *Voicy* is a voice recognition bot that converts all voice messages and audio files (.ogg, .flac, .wav, .mp3) it gets into text.\n\n*Voicy* supports three voice recognition engines: wit.ai, Yandex SpeechKit and Google Speech. Initialy it\'s set to use wit.ai but you can switch to Google Speech or Yandex SpeechKit anytime in /engine. More information is in /help.')
  ctx.replyWithMarkdown(text)
}

// Exports
module.exports = {
  setupStart,
  sendStart,
}
