const { sendEngine } = require('../helpers/engine/engine')
const checkAdminLock = require('../middlewares/adminLock')

function setupEngine(bot) {
  bot.command('engine', checkAdminLock, async (ctx) => {
    sendEngine(ctx)
  })
}

module.exports = setupEngine
