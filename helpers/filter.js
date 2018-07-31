/**
 * Function to check if date is not less than 5 minutes ago
 * @param {Telegraf:Context} ctx Context of the message
 */
function checkDate(ctx) {
  let message = ctx.update.message || ctx.update.channel_post || ctx.update.callback_query
  if (ctx.update.callback_query) {
    message = message.message
  }
  if (!message) {
    console.info('Not processing because no message found', JSON.stringify(ctx.update.channel_post, undefined, 2))
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
