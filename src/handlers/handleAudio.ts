import { Message } from '@grammyjs/types'
import Context from '@/models/Context'
import fileUrl from '@/helpers/fileUrl'
import report from '@/helpers/report'

const promoTexts = {
  ru: () => 'При поддержке [Бородач Инвест](https://invest.borodutch.com)',
  en: () => 'Powered by [Borodutch Invest](https://invest.borodutch.com)',
}

export default async function handleAudio(ctx: Context) {
  try {
    const message = ctx.msg
    const voice =
      message.voice || message.document || message.audio || message.video_note
    // Check size
    if (voice.file_size && voice.file_size >= 19 * 1024 * 1024) {
      if (!ctx.dbchat.silent) {
        await sendLargeFileError(ctx)
      }
      return
    }
    // Get full url to the voice message
    const fileData = await ctx.getFile()
    const voiceUrl = await fileUrl(fileData.file_path)
    // Send action or transcription depending on whether chat is silent
    await sendTranscription(ctx, voiceUrl, voice.file_id)
  } catch (error) {
    report(error, { ctx, location: 'handleMessage' })
  }
}

function sendLargeFileError(ctx: Context) {
  return ctx.reply(ctx.i18n.t('error_twenty'), {
    parse_mode: 'Markdown',
    reply_to_message_id: ctx.msg.message_id,
  })
}

async function sendTranscription(ctx: Context, url: string, fileId: string) {
  // Send typing action or dummy message
  let dummyMessage: Message
  if (ctx.dbchat.silent) {
    await ctx.replyWithChatAction('typing')
  } else {
    dummyMessage = await ctx.reply(ctx.i18n.t('initiated'), {
      reply_to_message_id: ctx.msg.message_id,
      parse_mode: 'Markdown',
    })
  }
  // Check if ok with google engine
  if (ctx.dbchat.engine === 'google' && !ctx.dbchat.googleKey) {
    if (dummyMessage) {
      await ctx.api.editMessageText(
        ctx.dbchat.id,
        dummyMessage.message_id,
        ctx.i18n.t('google_error_creds'),
        {
          parse_mode: 'Markdown',
        }
      )
    }
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
      ? textWithTimecodes.map((t) => `${t[0]}:\n${t[1]}`).join('\n')
      : textWithTimecodes
          .map((t) => t[1].trim())
          .filter((v) => !!v)
          .join('. ')
    await sendMessageWithTranscription(ctx, text, chat)
    // Save voice to db
    await addVoice(
      url,
      textWithTimecodes
        .map((t) => t[1].trim())
        .filter((v) => !!v)
        .join('. '),
      chat,
      duration,
      textWithTimecodes,
      fileId
    )
  } catch (error) {
    report(error, { ctx, location: 'sendTranscription.silent' })
  } finally {
    console.info(
      `audio message processed in ${
        (new Date().getTime() - ctx.timeReceived.getTime()) / 1000
      }s`
    )
  }
}

/**
 * Sends temp message first and then updates that message to the transcription or error
 * @param {Telegraf:Context} ctx Context of the message
 * @param {URL} url Url of audio file to transcript
 * @param {Mongoose:Chat} chat Chat object where message has been received
 */
async function sendTranscription2(ctx, url, fileId) {
  // Get message
  const message = ctx.message || ctx.update.channel_post
  // Send initial message
  const sentMessage = await sendVoiceRecognitionMessage(ctx, message)
  // Get language
  const lan = languageFromChat(chat)
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
      ? textWithTimecodes.map((t) => `${t[0]}:\n${t[1]}`).join('\n')
      : textWithTimecodes
          .map((t) => t[1].trim())
          .filter((v) => !!v)
          .join('. ')
    await updateMessagewithTranscription(ctx, sentMessage, text, chat)
    // Save voice to db
    await addVoice(
      url,
      textWithTimecodes
        .map((t) => t[1].trim())
        .filter((v) => !!v)
        .join('. '),
      chat,
      duration,
      textWithTimecodes,
      fileId
    )
  } catch (err) {
    // In case of error, send it
    await updateMessagewithError(ctx, sentMessage, chat, err)
    report(ctx, err, 'sendTranscription')
  } finally {
    // Log time
    console.info(
      `audio message processed in ${
        (new Date().getTime() - ctx.timeReceived.getTime()) / 1000
      }s`
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
  options.parse_mode = 'Markdown'
  options.disable_web_page_preview = true
  // Add promo
  if (text && !promoExceptions.includes(ctx.chat.id)) {
    const promoText = promoTexts[isRuChat(chat) ? 'ru' : 'en']()
    text = `${text}\n${promoText}`
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
    const chunks = text.match(/[\s\S]{1,4000}/g)
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
        ...options,
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
  options.parse_mode = 'Markdown'
  options.disable_web_page_preview = true
  // Add promo
  if (text && !promoExceptions.includes(ctx.chat.id)) {
    const promoText = promoTexts[isRuChat(chat) ? 'ru' : 'en']()
    text = `${text}\n${promoText}`
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
        ...options,
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
      text = `${text}\n\n\`\`\` ${error.message || 'Unknown error'}\`\`\``
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
    'witToken',
  ])
}

// Exports
module.exports = handleMessage
