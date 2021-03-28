const engineString = require('./engineString')
const logAnswerTime = require('../logAnswerTime')
const engines = require('../../engines')

async function sendEngine(ctx) {
  // Construct options keyboard
  const options = {
    reply_markup: {
      inline_keyboard: engines.map((e) => [
        { text: e.name, callback_data: `ei~${e.code}` },
      ]),
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
  // Get engine
  const engineObject = engines.find((e) => e.code === engine)
  // Edit message
  await ctx.editMessageText(
    ctx.i18n.t('engine_success', { engine: engineObject.name }),
    {
      parse_mode: 'Markdown',
    }
  )
  if (engineObject.messageWhenEngineIsSet) {
    ctx.reply(engineObject.messageWhenEngineIsSet)
  }
  // Log time
  logAnswerTime(ctx, 'setting engine')
}

module.exports = {
  sendEngine,
  setEngine,
}
