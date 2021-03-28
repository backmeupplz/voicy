const sendLanguage = require('../helpers/language/sendLanguage')
const checkAdminLock = require('../middlewares/adminLock')
const { updateLocale } = require('../helpers/language/languageConstants')
const engines = require('../engines')

function setupLanguage(bot) {
  bot.command('language', checkAdminLock, async (ctx) => {
    const engineObject = engines.find((e) => e.code === ctx.dbchat.engine)
    if (engineObject.languageException) {
      return ctx.reply(ctx.i18n.t(engineObject.languageException))
    }
    sendLanguage(ctx, true)
  })
  bot.command('l', checkAdminLock, async (ctx) => {
    // Check if just a command
    if (ctx.message.text.length <= 2) {
      sendLanguage(ctx, true)
    } else {
      const language = ctx.message.text.substring(3, ctx.message.text.length)
      if (!language) {
        return sendLanguage(ctx, true)
      }
      const engineObject = engines.find((e) => e.code === ctx.dbchat.engine)
      if (engineObject.languageException) {
        return ctx.reply(ctx.i18n.t(engineObject.languageException))
      }
      // Get actual language
      const languageObject = engineObject.languages.find(
        (l) => l.code.toLowerCase().indexOf(language.toLowerCase()) > -1
      )
      if (!languageObject) {
        return sendLanguage(ctx, true)
      }
      ctx.dbchat[`${engineObject.code}Language`] = languageObject.code
      // Save chat
      ctx.dbchat.save()
      // Setup i18n
      updateLocale(ctx)
      // Reply
      ctx.reply('👍')
    }
  })
}

module.exports = setupLanguage
