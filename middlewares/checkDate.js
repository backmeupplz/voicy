module.exports = function setupCheckDate(bot) {
  bot.use((ctx, next) => {
    if (ctx.update.callback_query) {
      next()
      return
    }
    const message =
      ctx.update.message || ctx.update.channel_post || ctx.update.callback_query
    if (!message) {
      console.info(
        'Not processing because no message found',
        JSON.stringify(ctx.update, undefined, 2)
      )
      return
    }
    const isMsgNew = Date.now() / 1000 - message.date < 5 * 60
    if (!isMsgNew) {
      console.info(
        'Not processing message',
        message.date,
        JSON.stringify(message, undefined, 2)
      )
    }
    if (isMsgNew) {
      next()
    }
  })
}
