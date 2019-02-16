// Dependencies
const { findChat } = require('./db')

/**
 * Sends engine message
 * @param {Telegaf:Context} ctx Context which should get response
 */
async function sendEngine(ctx) {
  // Get chat
  const chat = await findChat(
    ctx.chat ? ctx.chat.id : ctx.update.channel_post.chat.id
  )
  // Setup localizations
  const strings = require('./strings')()
  strings.setChat(chat)
  // Get text
  const text = strings.translate(
    '👋 Please, select the engine of speech recognition. Google Speech is more accurate, but has to be set up with your Google Cloud credentials (a bit tedious). Yandex SpeechKit is pretty accurate, free, but has limited list of languages. Wit.ai is less accurate, free, but has plenty of languages. Please, note that all three support different languages, so pick the one that suits you the best.'
  )
  // Construct options keyboard
  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'wit.ai', callback_data: 'ei~wit' }],
        [{ text: 'Google Speech', callback_data: 'ei~google' }],
        [{ text: 'Yandex SpeechKit', callback_data: 'ei~yandex' }],
      ],
    },
  }
  // Reply to the message
  if (ctx.message) {
    options.reply_to_message_id = ctx.message.message_id
  }
  options.reply_markup = JSON.stringify(options.reply_markup)
  // Reply with the keyboard
  await ctx.replyWithMarkdown(text, options)
  // Log time
  console.info(`/engine answered in ${(new Date().getTime() - ctx.timeReceived.getTime()) / 1000}s`)
}

/**
 * Called when inline button with engine is touched
 * @param {Telegraf:Context} ctx Relevant context
 */
async function setEngine(data, ctx) {
  // Get localizations
  const strings = require('./strings')()
  // Get options
  const options = data.split('~')
  const engine = options[1]
  // Get chat
  let chat = await findChat(ctx.chat.id)
  // Check if callback to reply
  if (
    ctx.update &&
    ctx.update.callback_query &&
    ctx.update.callback_query.message &&
    ctx.update.callback_query.message.reply_to_message
  ) {
    // Check if original caller
    const msg = ctx.update.callback_query.message.reply_to_message
    if (msg.from.id !== ctx.from.id) {
      // Setup localizations
      strings.setChat(chat)
      // Reply with error
      await ctx.telegram.answerCbQuery(
        ctx.callbackQuery.id,
        strings.translate(
          'Only the person who started command can select options'
        )
      )
      return
    }
  }
  // Set engine
  chat.engine = engine
  // Save chat
  chat = await chat.save()
  // Setup localizations
  strings.setChat(chat)
  // Get engine string
  let engineString
  if (engine === 'wit') {
    engineString = 'wit.ai'
  } else if (engine === 'google') {
    engineString = 'Google Speech'
  } else {
    engineString = 'Yandex SpeechKit'
  }
  // Edit message
  try {
    await ctx.editMessageText(
      strings.translate(
        "👍 Now *Voicy* uses *$[1]* in this chat. Thank you! Don't forget to set /language.",
        engineString
      ),
      {
        parse_mode: 'Markdown',
      }
    )
  } catch (err) {
    // Do nothing
  }
  // Log time
  console.info(`engine set in ${(new Date().getTime() - ctx.timeReceived.getTime()) / 1000}s`)
}

// Exports
module.exports = {
  sendEngine,
  setEngine,
}
