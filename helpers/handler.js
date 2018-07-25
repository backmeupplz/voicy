/**
 * Setting up audio handling
 * @param bot Bot to setup handling
 */
function setupAudioHandler(bot) {
  // Audio handler
  bot.on('audio', (ctx) => {
    console.info(ctx.message)
    return ctx.reply('Audio')
  })
  // Voice handler
  bot.on('voice', (ctx) => {
    console.info(ctx.message)
    return ctx.reply('Voice')
  })
  // Document handler
  bot.on('document', (ctx) => {
    console.info(ctx.message)
    return ctx.reply('Document')
  })
  // Video note handler
  bot.on('video_note', (ctx) => {
    console.info(ctx.message)
    return ctx.reply('Video note')
  })
  // Channel post handler
  bot.on('channel_post', (ctx) => {
    console.info(ctx.message)
    return ctx.reply('Channel post')
  })
}

// Exports
module.exports = {
  setupAudioHandler,
}
