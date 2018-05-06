/**
 * Used to send start message
 *
 * @module start
 * @license MIT
 */

/**
 * Sends start message to specified chat
 * @param {Telegam:Bot} bot Bot that should send start
 * @param {Mongoose:Chat} chat Chat where to send start
 */
function sendStart(bot, chat) {
  const strings = require('./strings')();
  
  strings.setChat(chat);
  let text;
  if (chat.seconds === 60) {
    text = strings.translate('👋 Hello there! *Voicy* is a voice recognition bot that converts all voice messages and audio files (.ogg, .flac, .wav, .mp3) it gets into text.\n\n*Voicy* supports three voice recognition engines: wit.ai (free), Yandex SpeechKit (free) and Google Speech (not free). Initialy it\'s set to use wit.ai but you can switch to Google Speech or Yandex SpeechKit anytime in /engine\n\nFor starters, you got *60 seconds* of Google Speech voice recognition for free. If you will need more Google Speech time, you can always purchase it here:\n$[1]\n\n...or just use free wit.ai or Yandex SpeechKit forever 😀', `[${chat.id}](t.me/voicybot?start=${chat.id})`);
  } else {
    text = strings.translate('👋 Hello there! *Voicy* is a voice recognition bot that converts all voice messages and audio files (.ogg, .flac, .wav, .mp3) it gets into text.\n\n*Voicy* supports three voice recognition engines: wit.ai (free), Yandex SpeechKit (free) and Google Speech (not free). Initialy it\'s set to use wit.ai but you can switch to Google Speech or Yandex SpeechKit anytime in /engine\n\nSo far you have *$[1] seconds* of Google Speech voice recognition left. If you will need more Google Speech time, you can always purchase it here:\n$[2]\n\n...or just use free wit.ai or Yandex SpeechKit forever 😀', chat.seconds, `[${chat.id}](t.me/voicybot?start=${chat.id})`);
  }
  bot.sendMessage(chat.id, text, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  });
}

/** Exports */
module.exports = {
  sendStart,
};
