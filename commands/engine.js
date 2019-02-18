// Dependencies
const { sendEngine } = require('../helpers/engine')
const checkAdminLock = require('../middlewares/adminLock')

function setupEngine(bot) {
  bot.command('engine', checkAdminLock, async ctx => {
    sendEngine(ctx)
  })
}

// Exports
module.exports = setupEngine
