// Dependencies
const logAnswerTime = require('../helpers/logAnswerTime')
const checkAdminLock = require('../middlewares/adminLock')

function setupVoiceGuard(bot) {
  bot.command('voiceGuard', checkAdminLock, async ctx => {

    // Reverse admin lock
    ctx.dbchat.checkVoiceSpelling = !ctx.dbchat.checkVoiceSpelling
    // Save chat
    ctx.dbchat = await ctx.dbchat.save()
    // Reply with the new setting
    await ctx.replyWithMarkdown(
      ctx.i18n.t(ctx.dbchat.checkVoiceSpelling ? 'voiceGuard_true' : 'voiceGuard_false')
    )
    // Log time
    logAnswerTime(ctx, '/voiceGuard')
  })
}

// Exports
module.exports = setupVoiceGuard
