// Dependencies
const sendLanguage = require('../helpers/language/sendLanguage')
const checkAdminLock = require('../middlewares/adminLock')
const {
  witCodes,
  googleLanguages,
  updateLocale,
} = require('../helpers/language/languageConstants')

function setupLanguage(bot) {
  bot.command('language', checkAdminLock, async ctx => {
    if (ctx.dbchat.engine === 'ashmanov') {
      return ctx.reply(ctx.i18n.t('ashmanov_language'))
    }
    sendLanguage(ctx, true)
  })
  bot.command('l', checkAdminLock, async ctx => {
    // Check if just a command
    if (ctx.message.text.length <= 2) {
      sendLanguage(ctx, true)
    } else {
      const language = ctx.message.text.substring(3, ctx.message.text.length)
      if (!language) {
        sendLanguage(ctx, true)
      }
      if (ctx.dbchat.engine === 'ashmanov') {
        return ctx.reply(ctx.i18n.t('ashmanov_language'))
      }
      // Get chat
      const chat = ctx.dbchat
      // Set languages to chat
      let changed = false
      for (const key of Object.keys(witCodes)) {
        if (witCodes[key].indexOf(language) > -1) {
          chat.witLanguage = key
          changed = true
          break
        }
      }
      for (const key of Object.keys(googleLanguages)) {
        if (googleLanguages[key].indexOf(language) > -1) {
          chat.googleLanguage = googleLanguages[key]
          changed = true
          break
        }
      }
      if (!changed) {
        sendLanguage(ctx, true)
        return
      }
      // Setup i18n
      updateLocale(ctx)
      // Save chat and return
      chat.save()
    }
  })
}

// Exports
module.exports = setupLanguage
