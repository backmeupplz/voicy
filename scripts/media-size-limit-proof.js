#!/usr/bin/env node

process.env.TOKEN = process.env.TOKEN || '123456:proof-token-secret'

require('reflect-metadata')
require('module-alias/register')

const assert = require('assert')
const handleAudioModule = require('../dist/handlers/handleAudio')
const {
  MAX_MEDIA_FILE_SIZE_BYTES,
  isMediaTooLarge,
} = require('../dist/helpers/mediaSizeLimit')
const {
  transcribableMediaFromMessage,
} = require('../dist/helpers/transcribableTelegramMedia')

const { enqueueTranscription } = handleAudioModule
const handleAudio = handleAudioModule.default

function messageFor(sourceType, fileSize) {
  const media = {
    file_id: `${sourceType}-file-id`,
    file_unique_id: `${sourceType}-unique-id`,
    file_size: fileSize,
  }

  if (sourceType === 'document') {
    return {
      message_id: 200,
      document: {
        ...media,
        file_name: 'meeting.m4a',
        mime_type: 'audio/mp4',
      },
    }
  }

  return {
    message_id: 200,
    [sourceType]: media,
  }
}

function contextFor(message) {
  const replies = []
  const chatActions = []

  return {
    replies,
    chatActions,
    dbchat: {
      id: 'media-size-limit-proof-chat',
      paid: true,
      silent: false,
      transcribeAllAudio: true,
      uiLanguage: 'en',
    },
    chat: { id: 12345, type: 'private' },
    from: { id: 67890 },
    msg: message,
    i18n: { t: (key) => key },
    api: {
      sendChatAction: async (chatId, action) => {
        chatActions.push({ chatId, action })
      },
    },
    reply: async (text, options) => {
      replies.push({ text, options })
      return { message_id: 300 }
    },
    timeReceived: new Date(),
  }
}

async function assertOversizedRejectedBeforeQueue(sourceType) {
  const message = messageFor(sourceType, MAX_MEDIA_FILE_SIZE_BYTES + 1)
  const media = transcribableMediaFromMessage(message)

  assert(media, `${sourceType} should be supported media`)
  assert(
    isMediaTooLarge(media.file_size),
    `${sourceType} over 100 MB should be rejected`
  )

  const ctx = contextFor(message)
  const directResult = await handleAudio(ctx)

  assert.equal(directResult, undefined)
  assert.equal(ctx.replies.length, 1, `${sourceType} should get one reply`)
  assert.equal(ctx.replies[0].text, 'error_file_too_large')
  assert.equal(
    ctx.replies[0].options.reply_to_message_id,
    message.message_id,
    `${sourceType} rejection should reply to source message`
  )
  assert.equal(
    ctx.chatActions.length,
    0,
    `${sourceType} rejection should not start progress/chat actions`
  )

  const enqueueCtx = contextFor(message)
  const enqueueResult = await enqueueTranscription(
    enqueueCtx,
    media.file_id,
    message
  )

  assert.equal(enqueueResult, undefined)
  assert.equal(
    enqueueCtx.replies.length,
    1,
    `${sourceType} enqueue guard should reply once`
  )
  assert.equal(enqueueCtx.replies[0].text, 'error_file_too_large')
  assert.equal(
    enqueueCtx.chatActions.length,
    0,
    `${sourceType} enqueue guard should not start progress/chat actions`
  )
}

for (const sourceType of [
  'voice',
  'audio',
  'video_note',
  'video',
  'document',
]) {
  const acceptedMessage = messageFor(sourceType, MAX_MEDIA_FILE_SIZE_BYTES)
  const acceptedMedia = transcribableMediaFromMessage(acceptedMessage)

  assert(acceptedMedia, `${sourceType} at 100 MB should be supported media`)
  assert(
    !isMediaTooLarge(acceptedMedia.file_size),
    `${sourceType} at 100 MB should be accepted by size gate`
  )
}

Promise.all(
  ['voice', 'audio', 'video_note', 'video', 'document'].map(
    assertOversizedRejectedBeforeQueue
  )
)
  .then(() => {
    console.log('media size limit proof passed')
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
