// Dependencies
const { findChat } = require('./db')

/**
 * Sends engine message
 * @param {Telegaf:Context} ctx Context which should get response
 */
async function sendEngine(ctx) {
  // Get chat
  const chat = await findChat(ctx.chat.id)
  // Setup localizations
  const strings = require('./strings')()
  strings.setChat(chat)
  // Get text
  const text = strings.translate('👋 Please, select the engine of speech recognition. Google Speech is more accurate and supports audio longer than 50 seconds, but has to be setup with your Google Cloud credentials (a bit tedious). Yandex SpeechKit is pretty accurate, free, private and most of the time supports audio longer than 50 seconds, but has limited list of languages. Wit.ai is less accurate, free, and doesn\'t support audio longer than 50 seconds, but has plenty of languages. Please, note that all three support ')
  // Construct options keyboard
  const options = {
    reply_markup: { inline_keyboard: [
      [{ text: 'wit.ai', callback_data: 'ei~~~wit' }],
      // [{ text: 'Google Speech', callback_data: 'ei~~~google' }], // TODO: turn on Google
      [{ text: 'Yandex SpeechKit', callback_data: 'ei~~~yandex' }],
    ] },
  }
  options.reply_markup = JSON.stringify(options.reply_markup)
  // Reply with the keyboard
  await ctx.replyWithMarkdown(text, options)
}

/**
 * Called when inline button with engine is touched
 * @param {Telegraf:Context} ctx Relevant context
 */
async function setEngine(data, ctx) {
  // Get localizations
  const strings = require('./strings')()
  // Get options
  const options = data.split('~~~')
  const engine = options[1]
  // Get chat
  let chat = await findChat(ctx.chat.id)
  // Set engine
  chat.engine = engine
  // Save chat
  chat = await chat.save()
  // Setup localizations
  strings.setChat(chat)
  // Get engine string
  let engineString
  if (engine === 'wit') {
    engineString = 'wit.ai'
  } else if (engine === 'google') {
    engineString = 'Google Speech'
  } else {
    engineString = 'Yandex SpeechKit'
  }
  // Edit message
  await ctx.editMessageText(strings.translate('👍 Now *Voicy* uses *$[1]* in this chat. Thank you! Don\'t forget to set /language.', engineString), {
    parse_mode: 'Markdown',
  })
}

// Exports
module.exports = {
  sendEngine,
  setEngine,
}
