// Dependencies
const logAnswerTime = require('../helpers/logAnswerTime')
const checkAdminLock = require('../middlewares/adminLock')

function setupHelp(bot) {
  bot.help(checkAdminLock, ctx => {
    handle(ctx)
  })
}

async function handle(ctx) {
  await ctx.replyWithMarkdown(ctx.i18n.t('help'), {
    disable_web_page_preview: true,
  })
  logAnswerTime(ctx, '/help')
}

// Exports
module.exports = setupHelp
