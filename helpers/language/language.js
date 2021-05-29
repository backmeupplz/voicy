const sendStart = require('../sendStart')
const {
  languageForEngineAndCode,
  updateLocale,
  languageString,
} = require('./languageConstants')
const engineString = require('../engine/engineString')
const languageKeyboard = require('./languageKeyboard')
const logAnswerTime = require('../logAnswerTime')
const engines = require('../../engines')

async function setLanguageCode(ctx) {
  const code = ctx.from.language_code.split('-')[0]
  // Get chat
  const chat = ctx.dbchat
  // Set languages to chat
  for (const engine of engines) {
    chat[`${engine.code}Language`] = engine.languageForTelegramCode(code)
  }
  // Setup Nanosemantics if needed
  if (code.toLowerCase().indexOf('ru') > -1) {
    chat.engine = 'ashmanov'
  }
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
    const page = parseInt(options[4], 10)
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
    try {
      await ctx.editMessageText(text, opts)
    } catch {
      // Do nothing
    }
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
  // Recomend Nanosemantics
  console.log('=====', engine, languageString(language, engine))
  if (engine === 'wit' && languageString(language, engine) === 'ru') {
    await ctx.reply(
      'Вы используете движок Wit.ai для распознавания русского языка. Советую вам попробовать Nanosemantics в /engine, он работает лучше с русским языком. Спасибо!'
    )
  }
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
