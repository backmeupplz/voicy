// Dependencies
const { sendEngine } = require('../helpers/engine')

/**
 * Setting up engine command
 * @param {Telegraf:Bot} bot Bot that should get engine setup
 */
function setupEngine(bot) {
  bot.command('engine', (ctx) => {
    sendEngine(ctx)
  })
}

// Exports
module.exports = {
  setupEngine,
}
