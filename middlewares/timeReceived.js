module.exports = function setupAddingTimeReceived(bot) {
  bot.use((ctx, next) => {
    if (ctx.message && ctx.message.date) {
      console.log(`Received message "${ctx.message.text}" ${ctx.message.date}`)
    }
    ctx.timeReceived = new Date()
    next()
  })
}
