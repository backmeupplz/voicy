// Dependencies
const logAnswerTime = require('../helpers/logAnswerTime')
const checkAdminLock = require('../middlewares/adminLock')

function setupRecognition(bot) {
  bot.command('voice', checkAdminLock, async ctx => {

    // Reverse admin lock
    ctx.dbchat.voiceToText = !ctx.dbchat.voiceToText
    // Save chat
    ctx.dbchat = await ctx.dbchat.save()
    // Reply with the new setting
    await ctx.replyWithMarkdown(
      ctx.i18n.t(ctx.dbchat.voiceToText ? 'voice_true' : 'voice_false')
    )
    // Log time
    logAnswerTime(ctx, '/voice')
  })
}

// Exports
module.exports = setupRecognition
