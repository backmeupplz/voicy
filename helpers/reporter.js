/**
 * Reports actions to admin
 *
 * @module reporter
 * @license MIT
 */

function reportProductHunt(bot, msg) {
  const from = (msg.from.username) ? `@${msg.from.username}` : `${msg.from.first_name||'🐷'} ${msg.from.last_name||'🐱'}`;
  const chat = (msg.chat.username) ? `@${msg.chat.username}` : `${msg.chat.id}`;
  bot.sendMessage('76104711', `🔥 ${from} just used Product Hunt discount in ${chat}.`);
}

/** Exports */
module.exports = {
  reportProductHunt,
};
