// Dependencies
const { findChat } = require('../helpers/db')

module.exports = function setupAttachChat(bot) {
  bot.use(async (ctx, next) => {
    ctx.dbchat = await findChat(ctx.chat.id)
    next()
  })
}
