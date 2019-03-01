const fs = require('fs')

module.exports = function setupAddingTimeReceived(bot) {
  bot.use((ctx, next) => {
    ctx.timeReceived = new Date()
    next()
    
    if (ctx.update.message && ctx.update.message.date) {
      fs.appendFile(`${__dirname}/../updates.log`, `\n${Math.floor(Date.now() / 1000)} — ${ctx.update.update_id} — ${Math.floor(Date.now() / 1000) - ctx.update.message.date}s`, (err) => {
        if (err) {
          console.error(err)
        }
      });
    }
  })
}
