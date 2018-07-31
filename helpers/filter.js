/**
 * Function to check if date is not less than 5 minutes ago
 * @param {Telegraf:Context} ctx Context of the message
 */
function checkDate(ctx) {
  const message = ctx.update.message || ctx.update.channelPost
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
