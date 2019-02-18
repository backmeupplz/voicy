// Dependencies
const { setLanguage } = require('./language')
const { setEngine } = require('./engine')

function setupCallbackHandler(bot) {
  bot.action(async (data, ctx) => {
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
module.exports = setupCallbackHandler
