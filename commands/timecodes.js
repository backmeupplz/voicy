// Dependencies
const logAnswerTime = require('../helpers/logAnswerTime')
const checkAdminLock = require('../middlewares/adminLock')

function setupTimecodes(bot) {
  bot.command('timecodes', checkAdminLock, ctx => {
    handle(ctx)
  })
}

async function handle(ctx) {
  // Reverse timestamps
  ctx.dbchat.timecodesEnabled = !ctx.dbchat.timecodesEnabled
  // Save chat
  ctx.dbchat = await ctx.dbchat.save()
  // Reply with the new setting
  await ctx.replyWithMarkdown(
    ctx.i18n.t(
      ctx.dbchat.timecodesEnabled ? 'timecodes_true' : 'timecodes_false'
    )
  )
  logAnswerTime(ctx, '/timecodes')
}

// Exports
module.exports = setupTimecodes
