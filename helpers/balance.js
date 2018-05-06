/**
 * Used to send balance message
 *
 * @module balance
 * @license MIT
 */

/**
 * Sends balance message to specified chat
 * @param {Telegam:Bot} bot Bot that should send balance
 * @param {Mongoose:Char} chat Chat that should receive the balance
 */
function sendBalance(bot, chat) {
  const strings = require('./strings')();
  strings.setChat(chat);
  const text = (chat.engine === 'wit' || chat.engine === 'yandex')?
  strings.translate('🎉 Unfortunately, being the most superior voice recognition engine, Google Speech is not free. If you want to keep using free wit.ai or Yandex SpeechKit for voice recognition, no need to do anything. However, if you want to use Google Speech you have to cover it\'s costs.\n\nThis chat has *$[1] seconds* of Google Speech voice recognition left.\n\nAnybody can buy more Google Speech seconds for the price of *$0.9 per 1000 seconds* here:\n$[2].', chat.seconds, `[${chat.id}](t.me/voicybot?start=${chat.id})`) :
  strings.translate('🎉 Unfortunately, being the most superior voice recognition engine, Google Speech is not free. If you want to switch to free wit.ai or Yandex SpeechKit for voice recognition, please do so in /engine. However, if you want to stick to Google Speech you have to cover it\'s costs.\n\nThis chat has *$[1] seconds* of Google Speech voice recognition left.\n\nAnybody can buy more Google Speech seconds for the price of *$0.9 per 1000 seconds* here:\n$[2].', chat.seconds, `[${chat.id}](t.me/voicybot?start=${chat.id})`);
  bot.sendMessage(chat.id, text, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  });
}

/**
 * Notifies chat about empty balance and asks for payments
 * @param {Telegram:Bot} bot Bot that should message
 * @param {Mongoose:Chat} chat Chat that should receive message
 */
function askForPayment(bot, chat) {
  const strings = require('./strings')();
  strings.setChat(chat);
  const text = strings.translate('😮 It looks like this chat has *no more seconds* of Google Speech voice recognition left! But no worries — we have automatically switched you to the free wit.ai so that no voice messages are getting lost. Don\'t forget to setup your /language.\n\nHowever if you would like to keep using Google Speech you will have to switch back in /engine and cover it\'s costs 💰\n\nAnybody can buy more seconds for the price of *$0.9 per 1000 seconds* here:\n$[1].', `[${chat.id}](t.me/voicybot?start=${chat.id})`);
  bot.sendMessage(chat.id, text, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  });
}

/** Exports */
module.exports = {
  sendBalance,
  askForPayment,
};
