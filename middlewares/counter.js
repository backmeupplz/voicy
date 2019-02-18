// Dependencies
const { countMessage } = require('../models/stats')

module.exports = function setupCounter(bot) {
  bot.use((ctx, next) => {
    next()
    countMessage()
  })
}
