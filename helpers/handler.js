// Dependencies
const handleMessage = require('./voice')
const logAnswerTime = require('../helpers/logAnswerTime')
const { Chat } = require('../models')
const messageTypes = require('./messageTypes')

function setupAudioHandler(bot) {
  // Voice handler
  bot.on(['voice', 'video_note'], (ctx) => {
    // Handle voice
    handleMessage(ctx, messageTypes.MESSAGE_VOICE)
    // Log time
    logAnswerTime(ctx, 'voice')
    // Save last voice message sent at
    updateLastVoiceMessageSentAt(ctx)
  })
  // Audio handler
  bot.on(['audio', 'document'], async (ctx) => {
    // Handle voice
    handleDocumentOrAudio(ctx)
    // Log time
    logAnswerTime(ctx, 'voice.document')
    // Save last voice message sent at
    updateLastVoiceMessageSentAt(ctx)
  })

  // Text handler
  bot.on('text', async (ctx) => {
    // Handle voice
    handleMessage(ctx, messageTypes.MESSAGE_TEXT)
    // Log time
    logAnswerTime(ctx, 'text')
    // Save last voice message sent at
    // updateLastVoiceMessageSentAt(ctx)
  })
}

async function updateLastVoiceMessageSentAt(ctx) {
  await Chat.updateOne(
    { id: `${ctx.chat.id}` },
    {
      lastVoiceMessageSentAt: new Date(),
    }
  )
}

async function handleDocumentOrAudio(ctx) {
  if (ctx.dbchat.filesBanned) return
  // Check if correct format
  if (!isCorrectDocument(ctx)) {
    return
  }
  // Handle voice
  handleMessage(ctx, messageTypes.MESSAGE_AUDIO)
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
module.exports = setupAudioHandler
