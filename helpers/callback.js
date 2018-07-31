// Dependencies
const { setLanguage } = require('./language')
const { setEngine } = require('./engine')
const { checkDate } = require('./filter')

/**
 * Setting up an endpoint for callbacks
 * @param {Telegraf:Bot} bot Bot to setup callback handler
 */
function setupCallbackHandler(bot) {
  // TODO: check if it's the original sender
  bot.action(async (data, ctx) => {
    // Check if less than 5 minutes ago
    if (!checkDate(ctx)) return
    
    const options = data.split('~')
    const inline = options[0]
    try {
      if (inline === 'li') {
        await setLanguage(data, ctx)
      } else if (inline === 'ei') {
        await setEngine(data, ctx)
      }
    } catch (error) {
      ctx.editMessageText(`❗️ _${error.message}_`)
    }
  })
}

// Exports
module.exports = { setupCallbackHandler }
