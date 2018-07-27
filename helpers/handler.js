// Dependencies
const { handleMessage } = require('./voice')
// const { findChat } = require('./db')

/**
 * Setting up audio handling
 * @param bot Bot to setup handling
 */
function setupAudioHandler(bot) {
  // Voice handler
  bot.on(['voice', 'video_note'], (ctx) => {
    // Handle voice
    handleMessage(ctx)
  })
  // Audio handler
  // bot.on(['audio', 'document'], async (ctx) => {
  //   // Check if files banned
  //   const chat = await findChat(ctx.chat.id)
  //   if (chat.filesBanned) return
  //   // Handle voice
  //   handleMessage(ctx)
  // })
}

// Exports
module.exports = {
  setupAudioHandler,
}
