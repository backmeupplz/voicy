// Dependencies
const { handleMessage } = require('./voice')
const { findChat } = require('./db')

/**
 * Setting up audio handling
 * @param bot Bot to setup handling
 */
function setupAudioHandler(bot) {
  // Voice handler
  bot.on(['voice', 'video_note'], (ctx) => {
    // Handle voice
    handleMessage(ctx, bot)
  })
  // Audio handler
  bot.on(['audio', 'document'], async (ctx) => {
    // Check if files banned
    const chat = await findChat(ctx.chat.id)
    if (chat.filesBanned) return
    // Handle voice
    handleMessage(ctx, bot)
  })
  // TODO: handle channels
  // // Channel post handler
  // bot.on('channel_post', (ctx) => {
  //   console.info(ctx.message || ctx.channelPost)
  //   return ctx.reply('Channel post')
  // })
}

// Exports
module.exports = {
  setupAudioHandler,
}
