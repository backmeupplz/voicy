// Dependencies
const urlFinder = require('./url')
const speechAPI = require('./speechAPI')
const download = require('download')
const temp = require('temp')
const fs = require('fs')
const flac = require('./flac')
const { findChat, findVoice, addVoice } = require('./db')
const report = require('./report')

/**
 * Handles any message that comes with voice
 * @param {Telegraf:Context} ctx Context of the request
 */
async function handleMessage(ctx) {
  try {
    // Get chat
    const chat = await findChat(ctx.chat.id)
    // Prepare localizations
    const strings = require('./strings')()
    strings.setChat(chat)
    // Get message
    const message = ctx.message || ctx.update.channel_post
    // Get voice message
    const voice =
      message.voice || message.document || message.audio || message.video_note
    // Send an error to user if file is larger than 20 mb
    if (voice.file_size && voice.file_size >= 19 * 1024 * 1024) {
      await ctx.replyWithMarkdown(
        strings.translate(
          "_👮 I can't recognize voice messages larger than 20 megabytes_"
        ),
        {
          parse_mode: 'Markdown',
          reply_to_message_id: message.message_id,
        }
      )
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
  // Prepare localizations
  const strings = require('./strings')()
  strings.setChat(chat)
  // Get message
  const message = ctx.message || ctx.update.channel_post
  // Send initial message
  const sentMessage = await ctx.replyWithMarkdown(
    strings.translate('_🦄 Voice recognition is initiated..._'),
    {
      reply_to_message_id: message.message_id,
    }
  )
  // Get language
  let lan
  if (chat.engine === 'google') {
    lan = chat.googleLanguage
  } else if (chat.engine === 'wit') {
    lan = chat.witLanguage
  } else {
    lan = chat.yandexLanguage
  }
  // Try to find existing voice message
  const dbvoice = await findVoice(url, lan, chat.engine)
  if (dbvoice && lan === dbvoice.language && dbvoice.engine === chat.engine) {
    return updateMessagewithTranscription(ctx, sentMessage, dbvoice.text, chat)
  }

  // Check if ok with google engine
  if (chat.engine === 'google' && !chat.googleKey) {
    return updateMessagewithTranscription(
      ctx,
      sentMessage,
      strings.translate(
        '😮 Please, set up google credentials with the /google command or change the engine with the /engine command. Your credentials are not set up yet.'
      ),
      chat,
      true
    )
  }

  // Download audio file
  const ogaPath = temp.path({ suffix: '.oga' })
  try {
    const data = await download(url)
    fs.writeFileSync(ogaPath, data)
  } catch (err) {
    await updateMessagewithError(ctx, sentMessage, chat, err)
    report(ctx, err, 'sendTranscription.downloadAudioFile')
    return
  }

  // Convert audio file to flac
  let flacPath
  let duration
  try {
    const result = await flac(ogaPath, chat)
    flacPath = result.flacPath
    duration = result.duration
  } catch (err) {
    await updateMessagewithError(ctx, sentMessage, chat, err)
    report(ctx, err, 'sendTranscription.convertAudioFile')
    return
  }

  // Check limits
  if (chat.engine === 'wit' && duration > 50) {
    await updateMessagewithTranscription(
      ctx,
      sentMessage,
      strings.translate(
        '_👮 Wit.ai cannot recognize voice messages longer than 50 seconds_'
      ),
      chat,
      true
    )
    // Unlink (delete) files
    fs.unlink(flacPath, () => {})
    fs.unlink(ogaPath, () => {})
    return
  }

  // No need for oga file anymore
  fs.unlink(ogaPath, () => {})

  // Convert flac file to speech
  try {
    // Get transcription
    const text = await speechAPI.getText(flacPath, chat, duration)
    // Unlink (delete) flac file
    fs.unlink(flacPath, () => {})
    // Send trancription to user
    await updateMessagewithTranscription(ctx, sentMessage, text, chat)
    // Save voice to db
    await addVoice(url, text, chat, duration)
  } catch (err) {
    // In case of error, send it
    await updateMessagewithError(ctx, sentMessage, chat, err)
    report(ctx, err, 'sendTranscription.convertFlacToText')
  }
}

/**
 * Sends typing action first and then sends transcription (doesn't send error)
 * @param {Telegraf:Context} ctx Context that triggered voice recognition
 * @param {URL} url Url of audio file to transcript
 * @param {Mongoose:Chat} chat Chat object where message has been received
 */
async function sendAction(ctx, url, chat) {
  // Prepare localizations
  const strings = require('./strings')()
  strings.setChat(chat)
  // Send typing action
  await ctx.replyWithChatAction('typing')
  // Try to find existing voice message
  let lan
  if (chat.engine === 'google') {
    lan = chat.googleLanguage
  } else if (chat.engine === 'wit') {
    lan = chat.witLanguage
  } else {
    lan = chat.yandexLanguage
  }
  const dbvoice = await findVoice(url, lan, chat.engine)
  if (dbvoice && lan === dbvoice.language && dbvoice.engine === chat.engine) {
    await sendMessageWithTranscription(ctx, dbvoice.text, chat)
    return
  }
  // Check if ok with google engine
  if (chat.engine === 'google' && !chat.googleKey) {
    return
  }

  // Download audio file
  const ogaPath = temp.path({ suffix: '.oga' })
  const data = await download(url)
  fs.writeFileSync(ogaPath, data)

  // Convert audio file to flac
  const { flacPath, duration } = await flac(ogaPath, chat)

  // Check limits
  if (chat.engine === 'wit' && duration > 50) {
    // Unlink (delete) files
    fs.unlink(flacPath, () => {})
    fs.unlink(ogaPath, () => {})
    return
  }
  // No need for oga file anymore
  fs.unlink(ogaPath, () => {})
  // Convert flac file to speech
  const text = await speechAPI.getText(flacPath, chat, duration)
  // Unlink (delete) flac file
  fs.unlink(flacPath, () => {})
  // Send trancription to user
  await sendMessageWithTranscription(ctx, text, chat)
  // Save voice to db
  await addVoice(url, text, chat, duration)
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
  // Get localization
  const strings = require('./strings')()
  strings.setChat(chat)
  // Create options
  const options = {}
  if (!text || markdown) {
    options.parse_mode = 'Markdown'
  }
  // Edit message
  await ctx.telegram.editMessageText(
    msg.chat.id,
    msg.message_id,
    null,
    text ||
      strings.translate(
        "_👮 Please, speak clearly, I couldn't recognize that_"
      ),
    options
  )
}

/**
 * Sending message with transcription to chat
 * @param {Telegraf:Context} ctx Context to respond to
 * @param {String} text Transcription
 * @param {Mongoose:Chat} chat Chat to respond to
 * @param {Boolean} markdown Whether should support markdown or not
 */
async function sendMessageWithTranscription(ctx, text, chat, markdown) {
  // Setup localizations
  const strings = require('./strings')()
  strings.setChat(chat)
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
  if (text) {
    await ctx.telegram.sendMessage(chat.id, text, options)
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
  // Setup localizations
  const strings = require('./strings')()
  strings.setChat(chat)
  // Get text
  let text = strings.translate("_👮 I couldn't recognize that_")
  if (chat.engine === 'google') {
    text = `${text}\n\n\`\`\` ${error.message ||
      JSON.stringify(error, undefined, 2)}\`\`\``
  }
  // Edit message
  await ctx.telegram.editMessageText(msg.chat.id, msg.message_id, null, text, {
    parse_mode: 'Markdown',
  })
}

// Exports
module.exports = {
  handleMessage,
}
