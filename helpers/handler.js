// Dependencies
const { handleMessage } = require('./voice')

/**
 * Setting up audio handling
 * @param bot Bot to setup handling
 */
function setupAudioHandler(bot) {
  // // Audio handler
  // bot.on('audio', (ctx) => {
  //   console.info(ctx.message)
  //   return ctx.reply('Audio')
  // })
  // Voice handler
  bot.on('voice', (ctx) => {
    handleMessage(ctx, bot)
  })
  // // Document handler
  // bot.on('document', (ctx) => {
  //   console.info(ctx.message)
  //   return ctx.reply('Document')
  // })
  // // Video note handler
  // bot.on('video_note', (ctx) => {
  //   console.info(ctx.message)
  //   return ctx.reply('Video note')
  // })
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
