// Dependencies
const logAnswerTime = require('../helpers/logAnswerTime')
const checkAdminLock = require('../middlewares/adminLock')

function setupUrl(bot) {
  bot.command('url', checkAdminLock, ctx => {
    handle(ctx)
  })
}

async function handle(ctx) {
  await ctx.replyWithMarkdown(ctx.i18n.t('oops'))
  logAnswerTime(ctx, '/url')
}

// Exports
module.exports = setupUrl
