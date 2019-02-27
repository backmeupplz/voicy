module.exports = function setupAddingTimeReceived(bot) {
  bot.use((ctx, next) => {
    if (ctx.message && ctx.message.date) {
      console.log(`Received message ${(Date.now() / 1000) - ctx.message.date}s ago`)
    }
    ctx.timeReceived = new Date()
    next()
  })
}
