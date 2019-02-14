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
  bot.on(['voice', 'video_note'], ctx => {
    // Check if less than 5 minutes ago
    if (!checkDate(ctx)) return
    // Handle voice
    handleMessage(ctx)
  })
  // Audio handler
  bot.on(['audio', 'document'], async ctx => {
    // Check if less than 5 minutes ago
    if (!checkDate(ctx)) return
    // Handle voice
    handleDocumentOrAudio(ctx)
  })
}

async function handleDocumentOrAudio(ctx) {
  // Check if files banned
  const chat = await findChat(ctx.chat.id)
  if (chat.filesBanned) return
  // Check if correct format
  if (!isCorrectDocument(ctx)) {
    return
  }
  // Handle voice
  handleMessage(ctx)
}

function isCorrectDocument(ctx) {
  const message = ctx.message || ctx.update.channel_post
  if (!message.document) {
    return true
  }
  const mime = message.document.mime_type
  const allowedMimeTypes = ['audio', 'octet-stream']
  for (const allowedType of allowedMimeTypes) {
    if (mime.indexOf(allowedType) > -1) {
      return true
    }
  }
  return false
}

// Exports
module.exports = {
  setupAudioHandler,
}
