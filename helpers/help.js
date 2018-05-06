/**
 * Used to send help message
 *
 * @module help
 * @license MIT
 */

/**
 * Sends help message to specified chat
 * @param {Telegam:Bot} bot Bot that should send help
 * @param {Mongoose:Chat} chat Chat where to send help
 * @param {Boolean} isPrivateChat Boolean that says that request came from private chat or not
 */
function sendHelp(bot, chat, isPrivateChat) {
  const strings = require('./strings')();
  
  strings.setChat(chat);
  const privateText = isPrivateChat ?
    '😎 *Voicy* converts speech to text from any voice messages and audio files (.ogg, .flac, .wav, .mp3) it receives. You can either talk to *Voicy* in the private chat or add it to a group.\n\n/help — Shows this message 😱\n/engine — Lets you pick a voice recognition engine: wit.ai (free), Yandex SpeechKit (free) or Google Speech (not free) ⚙\n/language — Lets you pick a voice recognition language 📣\n/balance — Shows how many Google Speech voice recognition seconds are left for this chat 🎉\n/files — Toggles if the bot should attempt to convert audio files or just ignore them 📁\n/silent — Toggles silent mode when no extra messages like `Voice recognition is initiated` are sent 😶\n\nLike this bot? Leave a review here: https://telegram.me/storebot?start=voicybot\n\nAddress any concerns and questions to my creator — @borodutch 🦄' :
    '😎 *Voicy* converts speech to text from any voice messages and audio files (.ogg, .flac, .wav, .mp3) it receives. You can either talk to *Voicy* in the private chat or add it to a group.\n\n/help — Shows this message 😱\n/engine — Lets you pick a voice recognition engine: wit.ai (free), Yandex SpeechKit (free) or Google Speech (not free) ⚙\n/language — Lets you pick a voice recognition language 📣\n/balance — Shows how many Google Speech voice recognition seconds are left for this chat 🎉\n/lock — Toggles lock or unlock of non-admins using commands 🔑\n/files — Toggles if the bot should attempt to convert audio files or just ignore them 📁\n/silent — Toggles silent mode when no extra messages like `Voice recognition is initiated` are sent 😶\n\nLike this bot? Leave a review here: https://telegram.me/storebot?start=voicybot\n\nAddress any concerns and questions to my creator — @borodutch 🦄';

  const text = strings.translate(privateText);
  bot.sendMessage(chat.id, text, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  });
}

/** Exports */
module.exports = {
  sendHelp,
};
