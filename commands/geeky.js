// Dependencies
const logAnswerTime = require('../helpers/logAnswerTime')
const checkAdminLock = require('../middlewares/adminLock')

function setupGeeky(bot) {
  bot.command('geeky', checkAdminLock, ctx => {
    handle(ctx)
  })
}

async function handle(ctx) {
  await ctx.replyWithMarkdown(ctx.i18n.t('geeky'))
  logAnswerTime(ctx, '/geeky')
}

// Exports
module.exports = setupGeeky
