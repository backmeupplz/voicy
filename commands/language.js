// Dependencies
const sendLanguage = require('../helpers/language/sendLanguage')
const checkAdminLock = require('../middlewares/adminLock')

function setupLanguage(bot) {
  bot.command('language', checkAdminLock, async ctx => {
    sendLanguage(ctx, true)
  })
}

// Exports
module.exports = setupLanguage
