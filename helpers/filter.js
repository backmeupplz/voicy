/**
 * Function to check if date is not less than 5 minutes ago
 * @param {Telegraf:Context} ctx Context of the message
 */
function checkDate(ctx) {
  const message = ctx.update.message || ctx.update.channelPost || ctx.update.callbackQuery
  if (!message) {
    console.info('Not processing because no message found', JSON.stringify(ctx.update, undefined, 2))
    return false
  }
  const isMsgNew = (Date.now() / 1000) - message.date < 5 * 60
  if (!isMsgNew) {
    console.info('Not processing message', message.date, JSON.stringify(message, undefined, 2))
  }
  return isMsgNew
}

// Exports
module.exports = {
  checkDate,
}
