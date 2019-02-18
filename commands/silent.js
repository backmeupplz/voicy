// Dependencies
const logAnswerTime = require('../helpers/logAnswerTime')
const checkAdminLock = require('../middlewares/adminLock')

function setupSilent(bot) {
  bot.command('silent', checkAdminLock, async ctx => {
    // Reverse silent
    ctx.dbchat.silent = !ctx.dbchat.silent
    // Save chat
    ctx.dbchat = await ctx.dbchat.save()
    // Send new setting
    await ctx.replyWithMarkdown(
      ctx.i18n.t(ctx.dbchat.silent ? 'silent_true' : 'silent_false')
    )
    // Log time
    logAnswerTime(ctx, '/silent')
  })
}

// Exports
module.exports = setupSilent
