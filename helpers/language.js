// Dependencies
const {
  yandexLanguages,
  witLanguages,
  witCodes,
  googleLanguages,
} = require('./languageConstants')
const { findChat } = require('./db')
const { sendStart } = require('../commands/start')

/**
 * Sets up language code for a particular chat
 * @param {Mongoose:Chat} chat Chat to set code to
 * @param {String} code COde received from Telegram
 */
async function setLanguageCode(chat, code) {
  // Get first part of the code
  code = code.split('-')[0]
  // Prepare dummy result
  const result = {}
  // Get yandex language
  const yandex = yandexLanguages()
  Object.keys(yandex).forEach((key) => {
    const value = yandex[key]
    if (value.includes(code)) {
      result.yandex = value
    }
  })
  if (!result.yandex) result.yandex = 'en-US'
  // Get google language
  const google = googleLanguages()
  Object.keys(google).forEach((key) => {
    const value = google[key]
    if (value.includes(code)) {
      result.google = value
    }
  })
  if (!result.google) {
    result.google = 'en-US'
  }
  // Get wit language
  const wit = witCodes()
  Object.keys(wit).forEach((key) => {
    if (code.includes(key)) {
      result.wit = wit[key]
    }
  })
  if (!result.wit) {
    result.wit = 'English'
  }
  // Set languages to chat
  chat.witLanguage = result.wit
  chat.googleLanguage = result.google
  chat.yandexLanguage = result.yandex
  // Save chat and return
  return await chat.save()
}

/**
 * Sends language picker keyboard
 * @param {Telegraf:Context} ctx Context to reply with language keyboard
 * @param {boolean} isCommand whether this function was called by a command or not
 */
async function sendLanguage(ctx, isCommand) {
  // Get chat
  const chat = await findChat(ctx.chat.id)
  // Get and setup localozations
  const strings = require('./strings')()
  strings.setChat(chat)
  // Get engine
  let engineString
  if (chat.engine === 'wit') {
    engineString = 'wit.ai'
  } else if (chat.engine === 'google') {
    engineString = 'Google Speech'
  } else {
    engineString = 'Yandex SpeechKit'
  }
  // Get text
  const text = isCommand ?
    strings.translate('👋 Please select the language of speech recognition for $[1]', engineString) :
    strings.translate('👋 Please select the language of speech recognition')
  // Create keyboard options
  const options = {
    reply_markup: { inline_keyboard: languageKeyboard(chat.engine, 0, isCommand) },
  }
  options.reply_markup = JSON.stringify(options.reply_markup)
  // Reply with keyboard
  ctx.replyWithMarkdown(text, options)
}

/**
 * Called when inline button with language is touched
 * @param {Telegraf:Context} ctx Context to respond to
 */
async function setLanguage(data, ctx) {
  // Get localization
  const strings = require('./strings')()
  // Get options
  const options = data.split('~')
  const engine = options[2]
  const isCommand = parseInt(options[1], 10) === 1
  // Setup language
  if (engine === 'yandex') {
    // Get extra options
    const language = options[3]
    const name = options[4]
    // Get chat
    let chat = await findChat(ctx.chat.id)
    // Set language
    chat.yandexLanguage = language
    // Save chat
    chat = await chat.save()
    // Setup localization
    strings.setChat(chat)
    // Edit message
    await ctx.editMessageText(strings.translate('👍 Now *Voicy* speaks *$[1]* (Yandex SpeechKit) in this chat. Thank you!', name), {
      parse_mode: 'Markdown',
    })
    // If it was not a command, send start
    if (!isCommand) await sendStart(ctx, chat)
  } else if (engine === 'wit') {
    // Get extra options
    const name = options[3]
    const page = parseInt(options[4], 10)
    // Get chat
    let chat = await findChat(ctx.chat.id)
    // Check if changing page
    if (name === '<' || name === '>') {
      // Setup localization
      strings.setChat(chat)
      // Get text
      const text = strings.translate('👋 Please select the language of speech recognition for wit.ai.')
      // Get keyboard options
      const opts = {
        reply_markup: { inline_keyboard: languageKeyboard(engine, name === '<' ? page - 1 : page + 1, isCommand) },
        parse_mode: 'Markdown',
      }
      opts.reply_markup = JSON.stringify(opts.reply_markup)
      // Edit message
      await ctx.editMessageText(text, opts)
    } else {
      // Set language
      chat.witLanguage = name
      // Save chat
      chat = await chat.save()
      // Setup localization
      strings.setChat(chat)
      // Edit message
      await ctx.editMessageText(strings.translate('👍 Now *Voicy* speaks *$[1]* (wit.ai) in this chat. Thank you!', name), {
        parse_mode: 'Markdown',
      })
      // If it was not a command, send start
      if (!isCommand) await sendStart(ctx, chat)
    }
  } else if (engine === 'google') {
    // Get extra options
    const language = options[3]
    const name = options[4]
    const page = parseInt(options[5], 10)
    // Get chat
    let chat = await findChat(ctx.chat.id)
    // Check if changing page
    if (language === '<' || language === '>') {
      // Setup localization
      strings.setChat(chat)
      // Get text
      const text = strings.translate('👋 Please select the language of speech recognition for Google Speech.')
      // Construct options for the keyaborad
      const opts = {
        reply_markup: { inline_keyboard: languageKeyboard(engine, language === '<' ? page - 1 : page + 1, isCommand) },
        parse_mode: 'Markdown',
      };
      opts.reply_markup = JSON.stringify(opts.reply_markup);
      // Edit message
      await ctx.editMessageText(text, opts)
    } else {
      // Set language
      chat.googleLanguage = language;
      // Safve chat
      chat = await chat.save()
      // Setup localization
      strings.setChat(chat)
      // Edit message
      await ctx.editMessageText(strings.translate('👍 Now *Voicy* speaks *$[1]* (Google Speech) in this chat. Thank you!', name), {
        parse_mode: 'Markdown',
      })
      // If it was not a command, send start
      if (!isCommand) await sendStart(ctx, chat)
    }
  }
}

/**
 * Returns an inline keyboard with all available languages
 * @param {String} engine Engine for which language should be set
 * @param {Int} page Page of language list
 * @return Inline keyboard with all available languages
 */
function languageKeyboard(engine, page, isCommand) {
  const keyboard = []
  let list

  if (engine === 'wit') {
    list = witLanguages()
  } else if (engine === 'google') {
    list = googleLanguages()
  } else {
    list = yandexLanguages()
  }

  let temp = []
  let i = 0
  const count = Object.keys(list).slice(page * 10, (page * 10) + 10).length
  Object.keys(list).slice(page * 10, (page * 10) + 10).forEach((name) => {
    const code = list[name]
    const data = (engine === 'wit') ?
      `li~${(isCommand ? 1 : 0)}~${engine}~${name}~${page}` :
      `li~${(isCommand ? 1 : 0)}~${engine}~${code}~${name}~${page}`
    if (engine === 'wit') {
      temp.push({
        text: name,
        callback_data: data,
      })

      if (i % 2 === 1 || i === count - 1) {
        keyboard.push(temp)
        temp = []
      }
      i += 1
    } else {
      keyboard.push([{
        text: name,
        callback_data: data,
      }])
    }
  })

  const nav = []
  const data1 = (engine === 'wit') ?
    `li~${(isCommand ? 1 : 0)}~${engine}~<~${page}` :
    `li~${(isCommand ? 1 : 0)}~${engine}~<~<~${page}`
  if (page > 0) {
    nav.push({
      text: '<',
      callback_data: data1,
    })
  }

  const data2 = (engine === 'wit') ?
    `li~${(isCommand ? 1 : 0)}~${engine}~>~${page}` :
    `li~${(isCommand ? 1 : 0)}~${engine}~>~>~${page}`
  if (page < ((Object.keys(list).length / 10) - 1)) {
    nav.push({
      text: '>',
      callback_data: data2,
    })
  }
  keyboard.unshift(nav)
  return keyboard
}

// Exports
module.exports = {
  sendLanguage,
  setLanguage,
  witLanguages,
  setLanguageCode,
}
