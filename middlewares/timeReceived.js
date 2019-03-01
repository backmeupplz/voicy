const fs = require('fs')

module.exports = function setupAddingTimeReceived(bot) {
  bot.use((ctx, next) => {
    ctx.timeReceived = new Date()
    next()
    
    if (ctx.update.message && ctx.update.message.date) {
      fs.appendFile(`${__dirname}/../updates.log`, `${Math.floor(Date.now() / 1000)} — ${Math.floor(Date.now() / 1000) - ctx.update.date}s`);
    }
  })
}
