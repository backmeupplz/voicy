// Dependencies
const logAnswerTime = require('../helpers/logAnswerTime')
const checkAdminLock = require('../middlewares/adminLock')

function setupLock(bot) {
  bot.command('lock', checkAdminLock, async ctx => {
    // Check if private or channel
    if (ctx.chat.type === 'private') {
      ctx.replyWithMarkdown(ctx.i18n.t('error_group'))
      return
    }
    // Reverse admin lock
    ctx.dbchat.adminLocked = !ctx.dbchat.adminLocked
    // Save chat
    ctx.dbchat = await ctx.dbchat.save()
    // Reply with the new setting
    await ctx.replyWithMarkdown(
      ctx.i18n.t(ctx.dbchat.adminLocked ? 'lock_true' : 'lock_false')
    )
    // Log time
    logAnswerTime(ctx, '/lock')
  })
}

// Exports
module.exports = setupLock
