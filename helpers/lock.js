/**
 * Used to handle /lock command
 *
 * @module lock
 * @license MIT
 */

/** Dependencies */
const db = require('./db');

function toggle(bot, chat) {
  const strings = require('./strings')();
  strings.setChat(chat);
  
  chat.adminLocked = !chat.adminLocked;
  chat.save()
    .then((newChat) => {
      const text = newChat.adminLocked ?
        '🔑 Great! *Voicy* will now respond only to command calls sent by *admins* in this chat.' :
        '🔑 Great! *Voicy* will now respond only to command calls from *anyone* in this chat.';
        bot.sendMessage(newChat.id, strings.translate(text), {
          parse_mode: 'Markdown',
        });
    })
    .catch(err => {/** todo: handle error */});
}

/** Exports */
module.exports = {
  toggle,
};
