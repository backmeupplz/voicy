const logAnswerTime = require('../helpers/logAnswerTime')
const checkAdminLock = require('../middlewares/adminLock')

function setupWitToken(bot) {
  bot.command('witToken', checkAdminLock, (ctx) => {
    handle(ctx)
  })
}

async function handle(ctx) {
  const witToken = ctx.message.text.split(' ')[1]
  // Reverse timestamps
  if (!witToken) {
    ctx.dbchat.witToken = undefined
  } else {
    ctx.dbchat.witToken = witToken
  }
  // Save chat
  ctx.dbchat = await ctx.dbchat.save()
  // Reply with the new setting
  await ctx.replyWithMarkdown('👍')
  logAnswerTime(ctx, '/witToken')
}

// Exports
module.exports = setupWitToken
