// Dependencies
const { setLanguage } = require('./language/language')
const { setEngine } = require('./engine/engine')

function setupCallbackHandler(bot) {
  bot.action(async (data, ctx) => {
    const msg = ctx.update.callback_query.message.reply_to_message
    if (msg && msg.from.id !== ctx.from.id) {
      ctx.telegram.answerCbQuery(
        ctx.callbackQuery.id,
        ctx.i18n.t('callback_error')
      )
      return
    }

    const options = data.split('~')
    const inline = options[0]
    if (inline === 'li') {
      setLanguage(data, ctx)
    } else if (inline === 'ei') {
      setEngine(data, ctx)
    }
  })
}

// Exports
module.exports = setupCallbackHandler
