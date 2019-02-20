// Dependencies
const languageKeyboard = require('./languageKeyboard')
const engineString = require('../engine/engineString')
const logAnswerTime = require('../logAnswerTime')

module.exports = async function sendLanguage(ctx, isCommand) {
  // Get chat
  const chat = ctx.dbchat
  // Get text
  const text = isCommand
    ? ctx.i18n.t('language', { engine: engineString(chat.engine) })
    : ctx.i18n.t('language_without_engine')
  // Create keyboard options
  const options = {
    reply_markup: {
      inline_keyboard: languageKeyboard(chat.engine, 0, isCommand),
    },
  }
  options.reply_markup = JSON.stringify(options.reply_markup)
  // Reply to the message
  if (ctx.message) {
    options.reply_to_message_id = ctx.message.message_id
  }
  // Reply with keyboard
  await ctx.replyWithMarkdown(text, options)
  // Log time
  logAnswerTime(ctx, '/language')
}
