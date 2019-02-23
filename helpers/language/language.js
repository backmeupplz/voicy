// Dependencies
const sendStart = require('../sendStart')
const {
  languageForEngineAndCode,
  updateLocale,
  languageString,
} = require('./languageConstants')
const engineString = require('../engine/engineString')
const languageKeyboard = require('./languageKeyboard')
const logAnswerTime = require('../logAnswerTime')

async function setLanguageCode(ctx) {
  const code = ctx.from.language_code.split('-')[0]
  // Get chat
  const chat = ctx.dbchat
  // Set languages to chat
  chat.witLanguage = languageForEngineAndCode('wit', code)
  chat.googleLanguage = languageForEngineAndCode('google', code)
  // Setup i18n
  updateLocale(ctx)
  // Save chat and return
  return chat.save()
}

async function setLanguage(data, ctx) {
  // Get options
  const options = data.split('~')
  const engine = options[2]
  const isCommand = parseInt(options[1], 10) === 1
  // Get language
  const language = options[3]
  // Check if pagination
  if (['<', '>'].indexOf(language) > -1) {
    // Get text
    const text = isCommand
      ? ctx.i18n.t('language', { engine: engineString(engine) })
      : ctx.i18n.t('language_without_engine')
    // Get page
    const page = parseInt(options[engine === 'wit' ? 4 : 5], 10)
    // Get keyboard options
    const opts = {
      reply_markup: {
        inline_keyboard: languageKeyboard(
          engine,
          language === '<' ? page - 1 : page + 1,
          isCommand
        ),
      },
      parse_mode: 'Markdown',
    }
    opts.reply_markup = JSON.stringify(opts.reply_markup)
    // Edit message
    await ctx.editMessageText(text, opts)
    return
  }
  // Set language
  ctx.dbchat[`${engine}Language`] = language
  // Update language
  updateLocale(ctx)
  // Save chat
  await ctx.dbchat.save()
  // Edit message
  ctx.editMessageText(
    ctx.i18n.t('language_success', {
      language: languageString(language, engine),
      engine: engineString(engine),
    }),
    {
      parse_mode: 'Markdown',
    }
  )
  // If it was not a command, send start
  if (!isCommand) sendStart(ctx)
  // Log time
  logAnswerTime(ctx, 'setting language')
}

// Exports
module.exports = {
  setLanguage,
  setLanguageCode,
}
