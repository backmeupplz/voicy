module.exports = function setupAddingTimeReceived(bot) {
  bot.use((ctx, next) => {
    ctx.timeReceived = new Date()
    next()
  })
}
