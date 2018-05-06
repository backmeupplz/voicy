/**
 * Used to send language picker
 *
 * @module language
 * @license MIT
 */

/** Dependencies */
const db = require('./db');
const start = require('./start');
const config = require('../config');

/**
 * Sends language message to specified chat
 * @param {Telegam:Bot} bot Bot that should send help
 * @param {Mongoose:Chat} chat Id Chat where to send help
 */
function sendLanguage(bot, chat, isCommand) {
  const strings = require('./strings')();

  strings.setChat(chat);
  let engineString;
  if (chat.engine === 'wit') {
    engineString = 'wit.ai';
  } else if (chat.engine === 'google') {
    engineString = 'Google Speech';
  } else {
    engineString = 'Yandex SpeechKit';
  }
  const text = isCommand ?
    strings.translate('👋 Please select the language of speech recognition for $[1].', engineString) :
    strings.translate('👋 Please select the language of speech recognition');
  const options = {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: languageKeyboard(chat.engine, 0, isCommand) },
  };
  options.reply_markup = JSON.stringify(options.reply_markup);
  bot.sendMessage(chat.id, text, options);
}

/**
 * Called when inline button with language is touched
 * @param {Telegram:Bot} bot Bot that should respond
 * @param {Telegram:Message} msg Message of inline button that was touched
 */
function setLanguage(bot, msg) {
  const strings = require('./strings')();
  const options = msg.data.split('~');
  const engine = options[2];
  const isCommand = parseInt(options[1], 10) === 1;

  if (engine === 'yandex') {
    const language = options[3];
    const name = options[4];
    const page = parseInt(options[5], 10);

    db.findChat(msg.message.chat.id)
      .then((chat) => {
        chat.yandexLanguage = language;
        return chat.save()
          .then((newChat) => {
            strings.setChat(newChat);
            bot.editMessageText(strings.translate('👍 Now *Voicy* speaks *$[1]* (Yandex SpeechKit) in this chat. Thank you!', name), {
              chat_id: msg.message.chat.id,
              message_id: msg.message.message_id,
              parse_mode: 'Markdown',
            }).then(() => {
              if (!isCommand) {
                start.sendStart(bot, newChat);
              }
            });
          });
      })
      .catch(err => updateMessagewithError(bot, msg.message, err));
  } else if (engine === 'wit') {
    const name = options[3];
    const page = parseInt(options[4], 10);

    if (name === '<' || name === '>') {
      db.findChat(msg.message.chat.id)
        .then((chat) => {
          strings.setChat(chat);
          const text = strings.translate('👋 Please select the language of speech recognition for wit.ai.');
          const options = {
            parse_mode: 'Markdown',
            chat_id: msg.message.chat.id,
            message_id: msg.message.message_id,
            reply_markup: { inline_keyboard: languageKeyboard(engine, name === '<' ? page-1 : page+1, isCommand) },
          };
          options.reply_markup = JSON.stringify(options.reply_markup);
          bot.editMessageText(text, options)
            .catch(err => {/** todo: handle error */});
        })
        .catch(err => updateMessagewithError(bot, msg.message, err));
      return;
    }

    db.findChat(msg.message.chat.id)
      .then((chat) => {
        chat.witLanguage = name;
        return chat.save()
          .then((newChat) => {
            strings.setChat(newChat);
            bot.editMessageText(strings.translate('👍 Now *Voicy* speaks *$[1]* (wit.ai) in this chat. Thank you!', name), {
              chat_id: msg.message.chat.id,
              message_id: msg.message.message_id,
              parse_mode: 'Markdown',
            }).then(() => {
              if (!isCommand) {
                start.sendStart(bot, newChat);
              }
            });
          });
      })
      .catch(err => updateMessagewithError(bot, msg.message, err));
  } else if (engine === 'google') {
    const language = options[3];
    const name = options[4];
    const page = parseInt(options[5], 10);

    if (language === '<' || language === '>') {
      db.findChat(msg.message.chat.id)
        .then((chat) => {
          strings.setChat(chat);
          const text = strings.translate('👋 Please select the language of speech recognition for Google Speech.');
          const options = {
            parse_mode: 'Markdown',
            chat_id: msg.message.chat.id,
            message_id: msg.message.message_id,
            reply_markup: { inline_keyboard: languageKeyboard(engine, language === '<' ? page-1 : page+1, isCommand) },
          };
          options.reply_markup = JSON.stringify(options.reply_markup);
          bot.editMessageText(text, options)
            .catch(err => {/** todo: handle error */});
        })
        .catch(err => updateMessagewithError(bot, msg.message, err));
      return;
    }

    db.findChat(msg.message.chat.id)
      .then((chat) => {
        chat.googleLanguage = language;
        return chat.save()
          .then((newChat) => {
            strings.setChat(newChat);
            bot.editMessageText(strings.translate('👍 Now *Voicy* speaks *$[1]* (Google Speech) in this chat. Thank you!', name), {
              chat_id: msg.message.chat.id,
              message_id: msg.message.message_id,
              parse_mode: 'Markdown',
            }).then(() => {
              if (!isCommand) {
                start.sendStart(bot, newChat);
              }
            });
          });
      })
      .catch(err => updateMessagewithError(bot, msg.message, err));
  }
}

function updateMessagewithError(bot, msg, error) {
  bot.editMessageText(`❗️ _${error.message}_`, {
    chat_id: msg.chat.id,
    message_id: msg.message_id,
    parse_mode: 'Markdown',
  });
}

/**
 * Returns an inline keyboard with all available languages
 * @param {Mongoose:Engine} engine Engine for which language should be set
 * @param {Int} page Page of language list
 * @return {Telegram:Inline} Inline keyboard with all available languages
 */
function languageKeyboard(engine, page, isCommand) {
  const keyboard = [];
  let list;

  if (engine === 'wit') {
    list = witLanguages();
  } else if (engine === 'google') {
    list = googleLanguages();
  } else {
    list = yandexLanguages();
  }

  let temp = [];
  let i = 0;
  const count = Object.keys(list).slice(page * 10, page * 10 + 10).length;
  Object.keys(list).slice(page * 10, page * 10 + 10).forEach((name) => {
    const code = list[name];
    const data = (engine === 'wit') ?
      `li~${(isCommand ? 1 : 0)}~${engine}~${name}~${page}` :
      `li~${(isCommand ? 1 : 0)}~${engine}~${code}~${name}~${page}`;
    if (engine === 'wit') {
      temp.push({
        text: name,
        callback_data: data,
      });

      if (i % 2 == 1 || i === count - 1) {
        keyboard.push(temp);
        temp = [];
      }
      i++;
    } else {
      keyboard.push([{
        text: name,
        callback_data: data,
      }]);
    }
  });

  const nav = [];
  const data1 = (engine === 'wit') ?
    `li~${(isCommand ? 1 : 0)}~${engine}~<~${page}` :
    `li~${(isCommand ? 1 : 0)}~${engine}~<~<~${page}`;
  if (page > 0) {
    nav.push({
      text: '<',
      callback_data: data1,
    });
  }

  const data2 = (engine === 'wit') ?
    `li~${(isCommand ? 1 : 0)}~${engine}~>~${page}` :
    `li~${(isCommand ? 1 : 0)}~${engine}~>~>~${page}`;
  if (page < (Object.keys(list).length / 10 - 1)) {
    nav.push({
      text: '>',
      callback_data: data2,
    });
  }
  keyboard.unshift(nav);
  return keyboard;
}

/**
 * Getting a list of available languages at Google
 * @return {Name:Language} Object of all available languages
 */
function googleLanguages() {
  return {
    'Afrikaans (Suid-Afrika)': 'af-ZA',
    'Bahasa Indonesia (Indonesia)': 'id-ID',
    'Bahasa Melayu (Malaysia)': 'ms-MY',
    'Català (Espanya)': 'ca-ES',
    'Čeština (Česká republika)': 'cs-CZ',
    'Dansk (Danmark)': 'da-DK',
    'Deutsch (Deutschland)': 'de-DE',
    'English (Australia)': 'en-AU',
    'English (Canada)': 'en-CA',
    'English (Great Britain)': 'en-GB',
    'English (India)': 'en-IN',
    'English (Ireland)': 'en-IE',
    'English (New Zealand)': 'en-NZ',
    'English (Philippines)': 'en-PH',
    'English (South Africa)': 'en-ZA',
    'English (United States)': 'en-US',
    'Español (Argentina)': 'es-AR',
    'Español (Bolivia)': 'es-BO',
    'Español (Chile)': 'es-CL',
    'Español (Colombia)': 'es-CO',
    'Español (Costa Rica)': 'es-CR',
    'Español (Ecuador)': 'es-EC',
    'Español (El Salvador)': 'es-SV',
    'Español (España)': 'es-ES',
    'Español (Estados Unidos)': 'es-US',
    'Español (Guatemala)': 'es-GT',
    'Español (Honduras)': 'es-HN',
    'Español (México)': 'es-MX',
    'Español (Nicaragua)': 'es-NI',
    'Español (Panamá)': 'es-PA',
    'Español (Paraguay)': 'es-PY',
    'Español (Perú)': 'es-PE',
    'Español (Puerto Rico)': 'es-PR',
    'Español (República Dominicana)': 'es-DO',
    'Español (Uruguay)': 'es-UY',
    'Español (Venezuela)': 'es-VE',
    'Euskara (Espainia)': 'eu-ES',
    'Filipino (Pilipinas)': 'fil-PH',
    'Français (France)': 'fr-FR',
    'Galego (España)': 'gl-ES',
    'Hrvatski (Hrvatska)': 'hr-HR',
    'IsiZulu (Ningizimu Afrika)': 'zu-ZA',
    'Íslenska (Ísland)': 'is-IS',
    'Italiano (Italia)': 'it-IT',
    'Lietuvių (Lietuva)': 'lt-LT',
    'Magyar (Magyarország)': 'hu-HU',
    'Nederlands (Nederland)': 'nl-NL',
    'Norsk bokmål (Norge)': 'nb-NO',
    'Polski (Polska)': 'pl-PL',
    'Português (Brasil)': 'pt-BR',
    'Português (Portugal)': 'pt-PT',
    'Română (România)': 'ro-RO',
    'Slovenčina (Slovensko)': 'sk-SK',
    'Slovenščina (Slovenija)': 'sl-SI',
    'Suomi (Suomi)': 'fi-FI',
    'Svenska (Sverige)': 'sv-SE',
    'Tiếng Việt (Việt Nam)': 'vi-VN',
    'Türkçe (Türkiye)': 'tr-TR',
    'Thai (Thailand)': 'th-TH',
    'Ελληνικά (Ελλάδα)': 'el-GR',
    'Български (България)': 'bg-BG',
    'Русский (Россия)': 'ru-RU',
    'Српски (Србија)': 'sr-RS',
    'Українська (Україна)': 'uk-UA',
    'עברית (ישראל)': 'he-IL',
    'العربية (إسرائيل)': 'ar-IL',
    'العربية (الأردن)': 'ar-JO',
    'العربية (الإمارات)': 'ar-AE',
    'العربية (البحرين)': 'ar-BH',
    'العربية (الجزائر)': 'ar-DZ',
    'العربية (السعودية)': 'ar-SA',
    'العربية (العراق)': 'ar-IQ',
    'العربية (الكويت)': 'ar-KW',
    'العربية (المغرب)': 'ar-MA',
    'العربية (تونس)': 'ar-TN',
    'العربية (عُمان)': 'ar-OM',
    'العربية (فلسطين)': 'ar-PS',
    'العربية (قطر)': 'ar-QA',
    'العربية (لبنان)': 'ar-LB',
    'العربية (مصر)': 'ar-EG',
    'فارسی (ایران)': 'fa-IR',
    'हिन्दी (भारत)': 'hi-IN',
    '한국어 (대한민국)': 'ko-KR',
    '國語 (台灣)': 'cmn-Hant-TW',
    '廣東話 (香港)': 'yue-Hant-HK',
    '日本語（日本)': 'ja-JP',
    '普通話 (香港)': 'cmn-Hans-HK',
    '普通话 (中国大陆)': 'cmn-Hans-CN',
  };
}

function yandexLanguages() {
  return {
    'Russian': 'ru-RU',
    'English': 'en-US',
    'Turkish': 'tr-TR',
    'Ukrainian': 'uk-UK',
  };
}

function witLanguages() {
  return config.wit_languages;
}

function witCodes() {
  return {
    'sq': 'Albanian',
    'ar': 'Arabic',
    'bn': 'Bengali',
    'bs': 'Bosnian',
    'bg': 'Bulgarian',
    'my': 'Burmese',
    'ca': 'Catalan',
    'zh': 'Chinese',
    'hr': 'Croatian',
    'cs': 'Czech',
    'da': 'Danish',
    'nl': 'Dutch',
    'en': 'English',
    'et': 'Estonian',
    'fi': 'Finnish',
    'fr': 'French',
    'ka': 'Georgian',
    'de': 'German',
    'el': 'Greek',
    'he': 'Hebrew',
    'hi': 'Hindi',
    'hu': 'Hungarian',
    'id': 'Indonesian',
    'is': 'Icelandic',
    'it': 'Italian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'la': 'Latin',
    'lt': 'Lithuanian',
    'mk': 'Macedonian',
    'ms': 'Malay',
    'no': 'Norwegian',
    'fa': 'Persian',
    'pl': 'Polish',
    'pt': 'Portugese',
    'ro': 'Romanian',
    'ru': 'Russian',
    'sr': 'Serbian',
    'sk': 'Slovak',
    'sl': 'Slovenian',
    'es': 'Spanish',
    'sw': 'Swahili',
    'sv': 'Swedish',
    'tl': 'Tagalog',
    'ta': 'Tamil',
    'th': 'Thai',
    'tr': 'Turkish',
    'uk': 'Ukrainian',
    'vi': 'Vietnamese',
  };
}

function setLanguageCode(chat, code) {
  const orCode = code;
  code = code.split('-')[0];
  const result = {};
  // Get yandex
  const yandex = yandexLanguages();
  Object.keys(yandex).forEach((key) => {
    const value = yandex[key];
    if (value.includes(code)) {
      result.yandex = value;
    }
  });
  if (!result.yandex) {
    result.yandex = 'en-US';
  }
  // Get google
  const google = googleLanguages();
  Object.keys(google).forEach((key) => {
    const value = google[key];
    if (value.includes(code)) {
      result.google = value;
    }
  });
  if (!result.google) {
    result.google = 'en-US';
  }
  // Get wit
  const wit = witCodes();
  Object.keys(wit).forEach((key) => {
    if (code.includes(key)) {
      result.wit = wit[key];
    }
  });
  if (!result.wit) {
    result.wit = 'English';
  }
  chat.witLanguage = result.wit;
  chat.googleLanguage = result.google;
  chat.yandexLanguage = result.yandex;
  chat.save();
  return result;
}

/** Exports */
module.exports = {
  sendLanguage,
  setLanguage,
  witLanguages,
  setLanguageCode,
};
