/**
 * Used to send engine picker
 *
 * @module engine
 * @license MIT
 */

/** Dependencies */
const db = require('./db');

/**
 * Sends engine message to specified chat
 * @param {Telegam:Bot} bot Bot that should send engine
 * @param {Telegram:Chat} chat Chat where to send engine
 */
function sendEngine(bot, chat) {
  const strings = require('./strings')();
  strings.setChat(chat);
  const text = strings.translate('👋 Please, select the engine of speech recognition. Google Speech is more accurate, private (your messages will never go public), support audio longer than 50 seconds, but not free. Yandex SpeechKit is pretty accurate, free, private and most of the time supports audio longer than 50 seconds, but has limited list of languages. Wit.ai is less accurate, public (your messages go to wit.ai public database), free, but doesn\'t support audio longer than 50 seconds.\n\nHere is the list of the supported languages:\n\n*wit.ai*: `Albanian, Arabic, Bengali, Bosnian, Bulgarian, Burmese, Catalan, Chinese, Croatian, Czech, Danish, Dutch, English, Estonian, Finnish, French, Georgian, German, Greek, Hebrew, Hindi, Hungarian, Icelandic, Indonesian, Italian, Japanese, Korean, Latin, Lithuanian, Macedonian, Malay, Norwegian, Persian, Polish, Portuguese, Romanian, Russian, Serbian, Slovak, Slovenian, Spanish, Swahili, Swedish, Tagalog, Tamil, Thai, Turkish, Ukrainian and Vietnamese`.\n\n*Yandex SpeechKit*: `Russian, English, Turkish, Ukrainian`.\n\n*Google Speech*: `Afrikaans, Indonesian, Malay, Catalan, Czech, Danish, German, English (Australia, Canada, United Kingdom, India, Ireland, New Zealand, Philippines, South Africa, United States), Spanish (Argentina, Bolivia, Chile, Colombia, Costa Rica, Ecuador, El Salvador, Spain, United States, Guatemala, Honduras, Mexico, Nicaragua, Panama, Paraguay, Peru, Puerto Rico, Dominican Republic, Uruguay, Venezuela), Basque,  Filipino, French, Galician, Croatian, Zulu, Icelandic, Italian, Lithuanian, Hungarian, Dutch, Norwegian Bokmål, Polish, Portuguese (Brazil, Portugal), Romanian, Slovak, Slovenian, Finnish, Swedish, Vietnamese, Turkish, Greek, Bulgarian, Russian, Serbian, Ukrainian, Hebrew, Arabic (Israel, Jordan, United Arab Emirates, Bahrain, Algeria, Saudi Arabia, Iraq, Kuwait, Morocco, Tunisia, Oman, State of Palestine, Qatar, Lebanon, Egypt), Persian, Hindi, Thai, Korean, Mandarin (Traditional, Taiwan; Simplified, Hong Kong; Simplified, China), Cantonese (Traditional, Hong Kong), Japanese (Japan)`.');
  const options = {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [
      [{ text: 'wit.ai', callback_data: 'ei~~~wit' },
      { text: 'Google Speech', callback_data: 'ei~~~google' }],
      [{ text: 'Yandex SpeechKit', callback_data: 'ei~~~yandex' }],
    ] },
  };
  options.reply_markup = JSON.stringify(options.reply_markup);
  bot.sendMessage(chat.id, text, options);
}

/**
 * Called when inline button with engine is touched
 * @param {Telegram:Bot} bot Bot that should respond
 * @param {Telegram:Message} msg Message of inline button that was touched
 */
function setEngine(bot, msg) {
  const strings = require('./strings')();

  const options = msg.data.split('~~~');
  const engine = options[1];

  db.findChat(msg.message.chat.id)
    .then((chat) => {
      chat.engine = engine;
      return chat.save()
        .then((newChat) => {
          strings.setChat(chat);
          let engineString;
          if (engine === 'wit') {
            engineString = 'wit.ai';
          } else if (engine === 'google') {
            engineString = 'Google Speech';
          } else {
            engineString = 'Yandex SpeechKit';
          }
          bot.editMessageText(strings.translate('👍 Now *Voicy* uses *$[1]* in this chat. Thank you! Don\'t forget to set /language.', engineString), {
            chat_id: msg.message.chat.id,
            message_id: msg.message.message_id,
            parse_mode: 'Markdown',
          });
        });
    })
    .catch(err => updateMessagewithError(bot, msg.message, err));
}

function updateMessagewithError(bot, msg, error) {
  bot.editMessageText(`❗️ _${error.message}_`, {
    chat_id: msg.chat.id,
    message_id: msg.message_id,
    parse_mode: 'Markdown',
  })
}

/** Exports */
module.exports = {
  sendEngine,
  setEngine,
};
