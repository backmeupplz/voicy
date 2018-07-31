// Dependencies
const { handleMessage } = require('./voice')
const { findChat } = require('./db')
const { checkDate } = require('./filter')

/**
 * Setting up audio handling
 * @param bot Bot to setup handling
 */
function setupAudioHandler(bot) {
  // Voice handler
  bot.on(['voice', 'video_note'], (ctx) => {
    // Check if less than 5 minutes ago
    if (!checkDate(ctx)) return
    
    // Handle voice
    handleMessage(ctx)
  })
  // Audio handler
  bot.on(['audio', 'document'], async (ctx) => {
    // Check if less than 5 minutes ago
    if (!checkDate(ctx)) return
    
    // Check if files banned
    const chat = await findChat(ctx.chat.id)
    if (chat.filesBanned) return
    // Handle voice
    handleMessage(ctx)
  })
}

// Exports
module.exports = {
  setupAudioHandler,
}
