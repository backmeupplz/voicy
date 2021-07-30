// Dependencies
const logAnswerTime = require('../helpers/logAnswerTime')
const checkAdminLock = require('../middlewares/adminLock')

function setupSmartGuard(bot) {
  bot.command('smartGuard', checkAdminLock, async ctx => {

    // Reverse admin lock
    ctx.dbchat.smartGuard = !ctx.dbchat.smartGuard
    // Save chat
    ctx.dbchat = await ctx.dbchat.save()
    // Reply with the new setting
    await ctx.replyWithMarkdown(
      ctx.i18n.t(ctx.dbchat.smartGuard ? 'smartGuard_true' : 'smartGuard_false')
    )
    // Log time
    logAnswerTime(ctx, '/smartGuard')
  })
}

// Exports
module.exports = setupSmartGuard
