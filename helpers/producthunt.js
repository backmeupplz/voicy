/**
 * Used to apply product hunt discount
 *
 * @module producthunt
 * @license MIT
 */

/** Dependencies */
const reporter = require('./reporter');

/**
 * Applies product hunt discount to specified chat
 * @param {Telegam:Bot} bot Bot that should send start
 * @param {Mongoose:Chat} chat Chat where to send start
 */
function applyDiscount(bot, chat, msg) {
  const strings = require('./strings')();
  
  strings.setChat(chat);
  if (chat.productHuntDiscountApplied) {
    const text = strings.translate('😅 Looks like you have already applied Product Hunt discount. Your first 100,000 Google Speech seconds are 50% off. Enjoy! 🐱');
    bot.sendMessage(chat.id, text, {
      parse_mode: 'Markdown',
    });
  } else {
    chat.productHuntDiscountApplied = true;
    chat.save()
      .then((savedChat) => {
        const text = strings.translate('🔥 Look who applied Product Hunt discount to @voicybot! Enjoy your first 100,000 Google Speech seconds at 50% the price! 🦄');
        bot.sendMessage(savedChat.id, text, {
          parse_mode: 'Markdown',
        });
        reporter.reportProductHunt(bot, msg);
      })
      .catch(err => {/** todo: handle error */});
  }
}

/** Exports */
module.exports = {
  applyDiscount,
};
