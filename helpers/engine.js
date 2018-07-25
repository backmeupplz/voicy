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
  const text = strings.translate('👋 Please, select the engine of speech recognition. Google Speech is more accurate and supports audio longer than 50 seconds. Yandex SpeechKit is pretty accurate, free, private and most of the time supports audio longer than 50 seconds, but has limited list of languages. Wit.ai is less accurate, free, and doesn\'t support audio longer than 50 seconds.\n\nHere is the list of the supported languages:\n\n*wit.ai*: `Albanian, Arabic, Bengali, Bosnian, Bulgarian, Burmese, Catalan, Chinese, Croatian, Czech, Danish, Dutch, English, Estonian, Finnish, French, Georgian, German, Greek, Hebrew, Hindi, Hungarian, Icelandic, Indonesian, Italian, Japanese, Korean, Latin, Lithuanian, Macedonian, Malay, Norwegian, Persian, Polish, Portuguese, Romanian, Russian, Serbian, Slovak, Slovenian, Spanish, Swahili, Swedish, Tagalog, Tamil, Thai, Turkish, Ukrainian and Vietnamese`.\n\n*Yandex SpeechKit*: `Russian, English, Turkish, Ukrainian`.\n\n*Google Speech*: `Afrikaans, Indonesian, Malay, Catalan, Czech, Danish, German, English (Australia, Canada, United Kingdom, India, Ireland, New Zealand, Philippines, South Africa, United States), Spanish (Argentina, Bolivia, Chile, Colombia, Costa Rica, Ecuador, El Salvador, Spain, United States, Guatemala, Honduras, Mexico, Nicaragua, Panama, Paraguay, Peru, Puerto Rico, Dominican Republic, Uruguay, Venezuela), Basque,  Filipino, French, Galician, Croatian, Zulu, Icelandic, Italian, Lithuanian, Hungarian, Dutch, Norwegian Bokmål, Polish, Portuguese (Brazil, Portugal), Romanian, Slovak, Slovenian, Finnish, Swedish, Vietnamese, Turkish, Greek, Bulgarian, Russian, Serbian, Ukrainian, Hebrew, Arabic (Israel, Jordan, United Arab Emirates, Bahrain, Algeria, Saudi Arabia, Iraq, Kuwait, Morocco, Tunisia, Oman, State of Palestine, Qatar, Lebanon, Egypt), Persian, Hindi, Thai, Korean, Mandarin (Traditional, Taiwan; Simplified, Hong Kong; Simplified, China), Cantonese (Traditional, Hong Kong), Japanese (Japan)`.')
  // Construct options keyboard
  const options = {
    reply_markup: { inline_keyboard: [
      [{ text: 'wit.ai', callback_data: 'ei~~~wit' },
      { text: 'Google Speech', callback_data: 'ei~~~google' }],
      [{ text: 'Yandex SpeechKit', callback_data: 'ei~~~yandex' }],
    ] },
  }
  options.reply_markup = JSON.stringify(options.reply_markup)
  // Reply with the keyboard
  await ctx.replyWithMarkdown(chat.id, text, options)
}

/**
 * Called when inline button with engine is touched
 * @param {Telegraf:Context} ctx Relevant context
 */
async function setEngine(ctx) {
  // Get localizations
  const strings = require('./strings')()
  // Get options
  const options = ctx.callbackQuery.data.data.split('~~~')
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
  await ctx.editMessageText(strings.translate('👍 Now *Voicy* uses *$[1]* in this chat. Thank you! Don\'t forget to set /language.', engineString))
}

// Exports
module.exports = {
  sendEngine,
  setEngine,
}
