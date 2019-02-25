// Dependencies
const urlFinder = require('./url')
const { findChat, findVoice, addVoice } = require('./db')
const { report } = require('./report')
const urlToText = require('./urlToText')
const _ = require('lodash')

/**
 * Handles any message that comes with voice
 * @param {Telegraf:Context} ctx Context of the request
 */
async function handleMessage(ctx) {
  try {
    // Get chat
    const chat = await findChat(ctx.chat.id)
    // Get message
    const message = ctx.message || ctx.update.channel_post
    // Get voice message
    const voice =
      message.voice || message.document || message.audio || message.video_note
    // Send an error to user if file is larger than 20 mb
    if (voice.file_size && voice.file_size >= 19 * 1024 * 1024) {
      if (!chat.silent) {
        await sendLargeFileError(ctx, message)
      }
      return
    }
    // Get full url to the voice message
    const fileData = await ctx.telegram.getFile(voice.file_id)
    const voiceUrl = await urlFinder.fileUrl(fileData.file_path)
    // Send action or transcription depending on whether chat is silent
    if (chat.silent) {
      try {
        await sendAction(ctx, voiceUrl, chat)
      } catch (err) {
        report(ctx, err, 'sendAction')
      }
    } else {
      try {
        await sendTranscription(ctx, voiceUrl, chat)
      } catch (err) {
        report(ctx, err, 'sendTranscription')
      }
    }
  } catch (err) {
    report(ctx, err, 'handleMessage')
  }
}

/**
 * Sends temp message first and then updates that message to the transcription or error
 * @param {Telegraf:Context} ctx Context of the message
 * @param {URL} url Url of audio file to transcript
 * @param {Mongoose:Chat} chat Chat object where message has been received
 */
async function sendTranscription(ctx, url, chat) {
  // Get message
  const message = ctx.message || ctx.update.channel_post
  // Send initial message
  const sentMessage = await sendVoiceRecognitionMessage(ctx, message)
  // Get language
  const lan = languageFromChat(chat)
  // Try to find existing voice message
  const dbvoice = await findVoice(url, lan, chat.engine)
  if (dbvoice) {
    const text = chat.timecodesEnabled
      ? dbvoice.textWithTimecodes
        ? dbvoice.textWithTimecodes.map(t => `${t[0]}:\n${t[1]}`).join('\n')
        : dbvoice.text
      : dbvoice.text
    updateMessagewithTranscription(ctx, sentMessage, text, chat)
    return
  }
  // Check if ok with google engine
  if (chat.engine === 'google' && !chat.googleKey) {
    updateWithGoogleKeyError(ctx, sentMessage, chat)
    return
  }
  try {
    // Convert url to text
    const { textWithTimecodes, duration } = await urlToText(
      url,
      sanitizeChat(chat)
    )
    // Send trancription to user
    const text = chat.timecodesEnabled
      ? textWithTimecodes.map(t => `${t[0]}:\n${t[1]}`).join('\n')
      : textWithTimecodes.map(t => t[1]).join('. ')
    await updateMessagewithTranscription(ctx, sentMessage, text, chat)
    // Save voice to db
    await addVoice(
      url,
      textWithTimecodes.map(t => t[1]).join('. '),
      chat,
      duration,
      textWithTimecodes
    )
  } catch (err) {
    // In case of error, send it
    await updateMessagewithError(ctx, sentMessage, chat, err)
    report(ctx, err, 'sendTranscription')
  } finally {
    // Log time
    console.info(
      `audio message processed in ${(new Date().getTime() -
        ctx.timeReceived.getTime()) /
        1000}s`
    )
  }
}

/**
 * Sends typing action first and then sends transcription (doesn't send error)
 * @param {Telegraf:Context} ctx Context that triggered voice recognition
 * @param {URL} url Url of audio file to transcript
 * @param {Mongoose:Chat} chat Chat object where message has been received
 */
async function sendAction(ctx, url, chat) {
  // Send typing action
  await ctx.replyWithChatAction('typing')
  // Try to find existing voice message
  const lan = languageFromChat(chat)
  // Try to find existing voice message
  const dbvoice = await findVoice(url, lan, chat.engine)
  if (dbvoice) {
    const text = chat.timecodesEnabled
      ? dbvoice.textWithTimecodes
        ? dbvoice.textWithTimecodes.map(t => `${t[0]}:\n${t[1]}`).join('\n')
        : dbvoice.text
      : dbvoice.text
    sendMessageWithTranscription(ctx, text, chat)
    return
  }
  // Check if ok with google engine
  if (chat.engine === 'google' && !chat.googleKey) {
    return
  }
  try {
    // Convert utl to text
    const { textWithTimecodes, duration } = await urlToText(
      url,
      sanitizeChat(chat)
    )
    // Send trancription to user
    const text = chat.timecodesEnabled
      ? textWithTimecodes.map(t => `${t[0]}:\n${t[1]}`).join('\n')
      : textWithTimecodes.map(t => t[1]).join('. ')
    await sendMessageWithTranscription(ctx, text, chat)
    // Save voice to db
    await addVoice(
      url,
      textWithTimecodes.map(t => t[1]).join('. '),
      chat,
      duration,
      textWithTimecodes
    )
  } catch (err) {
    // In case of error, log it
    report(ctx, err, 'sendTranscription.silent')
  } finally {
    // Log time
    console.info(
      `audio message processed in ${(new Date().getTime() -
        ctx.timeReceived.getTime()) /
        1000}s`
    )
  }
}

/**
 * Updates message with text
 * @param {Telegraf:Context} ctx Context of the message
 * @param {Telegraf:Message} msg Message to be updated
 * @param {String} text Text that the message should be updated to
 * @param {Mongoose:Chat} chat Relevant to this voice chat
 * @param {Boolean} markdown Whether to support markdown or not
 */
async function updateMessagewithTranscription(ctx, msg, text, chat, markdown) {
  // Create options
  const options = {}
  if (!text || markdown) {
    options.parse_mode = 'Markdown'
  }
  if (!text || text.length <= 4000) {
    // Edit message
    await ctx.telegram.editMessageText(
      msg.chat.id,
      msg.message_id,
      null,
      text || ctx.i18n.t('speak_clearly'),
      options
    )
  } else {
    // Get chunks
    const chunks = text.match(/.{1,4000}/g)
    // Edit message
    await ctx.telegram.editMessageText(
      msg.chat.id,
      msg.message_id,
      null,
      chunks.shift(),
      options
    )
    // Send the rest of text
    for (const chunk of chunks) {
      await ctx.reply(chunk, {
        reply_to_message_id: msg.message_id,
      })
    }
  }
}

/**
 * Sending message with transcription to chat
 * @param {Telegraf:Context} ctx Context to respond to
 * @param {String} text Transcription
 * @param {Mongoose:Chat} chat Chat to respond to
 * @param {Boolean} markdown Whether should support markdown or not
 */
async function sendMessageWithTranscription(ctx, text, chat, markdown) {
  // Get message
  const message = ctx.message || ctx.update.channel_post
  // Create options
  const options = {
    reply_to_message_id: message.message_id,
  }
  if (!text || markdown) {
    options.parse_mode = 'Markdown'
  }
  // Send message
  if (text && text.length < 4000) {
    await ctx.telegram.sendMessage(chat.id, text, options)
  } else if (text) {
    // Get chunks
    const chunks = text.match(/.{1,4000}/g)
    // Edit message
    const sentMessage = await ctx.telegram.sendMessage(
      chat.id,
      chunks.shift(),
      options
    )
    // Send the rest of text
    for (const chunk of chunks) {
      await ctx.reply(chunk, {
        reply_to_message_id: sentMessage.message_id,
      })
    }
  }
}

/**
 * Function to update the message with error
 * @param {Telegraf:Context} ctx Context of the message
 * @param {Telegraf:Message} msg Message to be updated
 * @param {Mongoose:Chat} chat Relevant chat
 * @param {Error} error Error of this message
 */
async function updateMessagewithError(ctx, msg, chat, error) {
  try {
    // Get text
    let text = ctx.i18n.t('error')
    if (chat.engine === 'google') {
      text = `${text}\n\n\`\`\` ${error.message ||
        JSON.stringify(error, undefined, 2)}\`\`\``
    }
    // Edit message
    await ctx.telegram.editMessageText(
      msg.chat.id,
      msg.message_id,
      null,
      text,
      {
        parse_mode: 'Markdown',
      }
    )
  } catch (err) {
    report(ctx, err, 'updateMessagewithError')
  }
}

function languageFromChat(chat) {
  return chat.engine === 'google' ? chat.googleLanguage : chat.witLanguage
}

function sendLargeFileError(ctx, message) {
  return ctx.replyWithMarkdown(ctx.i18n.t('error_twenty'), {
    parse_mode: 'Markdown',
    reply_to_message_id: message.message_id,
  })
}

function sendVoiceRecognitionMessage(ctx, message) {
  return ctx.replyWithMarkdown(ctx.i18n.t('initiated'), {
    reply_to_message_id: message.message_id,
  })
}

function updateWithGoogleKeyError(ctx, sentMessage, chat) {
  updateMessagewithTranscription(
    ctx,
    sentMessage,
    ctx.i18n.t('google_error_creds'),
    chat,
    true
  )
}

function sanitizeChat(chat) {
  return _.pick(chat, [
    'id',
    'engine',
    'googleLanguage',
    'witLanguage',
    'adminLocked',
    'silent',
    'filesBanned',
    'googleSetupMessageId',
    'googleKey',
    'language',
  ])
}

// Exports
module.exports = handleMessage
