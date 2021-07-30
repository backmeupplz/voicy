// Dependencies
const logAnswerTime = require('../helpers/logAnswerTime')
const checkAdminLock = require('../middlewares/adminLock')

function setupGuard(bot) {
  bot.command('guard', checkAdminLock, async ctx => {

    // Reverse admin lock
    ctx.dbchat.guardEnabled = !ctx.dbchat.guardEnabled
    // Save chat
    ctx.dbchat = await ctx.dbchat.save()
    // Reply with the new setting
    await ctx.replyWithMarkdown(
      ctx.i18n.t(ctx.dbchat.guardEnabled ? 'guard_true' : 'guard_false')
    )
    // Log time
    logAnswerTime(ctx, '/guard')
  })
}

// Exports
module.exports = setupGuard
