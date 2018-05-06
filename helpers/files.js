/**
 * Used to handle /files command
 *
 * @module files
 * @license MIT
 */

/**
 * Used to toggle 'acccepts files' property of chat
 * @param {[type]} bot [description]
 * @param {[type]} chat [description]
 * @return {[type]} [description]
 */
function toggle(bot, chat) {
  const strings = require('./strings')();
  strings.setChat(chat);

  chat.filesBanned = !chat.filesBanned;
  chat.save()
    .then((newChat) => {
      const text = newChat.filesBanned ?
        '📁 Wonderful! *Voicy* will *ignore* all audio files in this chat since now.' :
        '📁 Wonderful! *Voicy* will *try to recognize* all audio files in this chat since now.';
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
