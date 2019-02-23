// Dependencies
const engineString = require('./engineString')
const logAnswerTime = require('../logAnswerTime')

async function sendEngine(ctx) {
  // Construct options keyboard
  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'wit.ai', callback_data: 'ei~wit' }],
        [{ text: 'Google Speech', callback_data: 'ei~google' }],
      ],
    },
  }
  // Reply to the message
  if (ctx.message) {
    options.reply_to_message_id = ctx.message.message_id
  }
  options.reply_markup = JSON.stringify(options.reply_markup)
  // Reply with the keyboard
  await ctx.replyWithMarkdown(ctx.i18n.t('engine'), options)
  // Log time
  logAnswerTime(ctx, '/engine')
}

async function setEngine(data, ctx) {
  // Get options
  const options = data.split('~')
  const engine = options[1]
  // Set engine
  ctx.dbchat.engine = engine
  // Save chat
  ctx.dbchat = await ctx.dbchat.save()
  // Edit message
  await ctx.editMessageText(
    ctx.i18n.t('engine_success', { engine: engineString(engine) }),
    {
      parse_mode: 'Markdown',
    }
  )
  // Log time
  logAnswerTime(ctx, 'setting engine')
}

// Exports
module.exports = {
  sendEngine,
  setEngine,
}
