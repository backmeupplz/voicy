// Dependencies
const { setLanguage } = require('./language')
const { setEngine } = require('./engine')

/**
 * Setting up an endpoint for callbacks
 * @param {Telegraf:Bot} bot Bot to setup callback handler
 */
function setupCallbackHandler(bot) {
  // TODO: check if it's the original sender
  bot.action(async (ctx) => {
    const options = ctx.callbackQuery.data.split('~')
    const inline = options[0]
    try {
      if (inline === 'li') {
        await setLanguage(ctx)
      } else if (inline === 'ei') {
        await setEngine(ctx)
      }
    } catch (error) {
      ctx.editMessageText(`❗️ _${error.message}_`)
    }
  })
}

// Exports
module.exports = { setupCallbackHandler }
