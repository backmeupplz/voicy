// Dependencies
const { sendLanguage } = require('../helpers/language')

/**
 * Setting up language command
 * @param {Telegraf:Bot} bot Bot that should get language setup
 */
function setupLanguage(bot) {
  bot.command('language', (ctx) => {
    sendLanguage(ctx, true)
  })
}

// Exports
module.exports = {
  setupLanguage,
}
