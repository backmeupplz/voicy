/**
 * Used to handle /silent command
 *
 * @module silent
 * @license MIT
 */

function toggle(bot, chat) {
  const strings = require('./strings')();
  strings.setChat(chat);

  chat.silent = !chat.silent;
  chat.save()
    .then((newChat) => {
      const text = newChat.silent ?
        '😶 Magnificent! *Voicy* will now work in *silent mode*: it will not send any messages to the chat except for the actual voice transcriptions.' :
        '😏 Magnificent! *Voicy* will now work in *usual mode*: it will send `Voice recognition is initiated` messages right after it receives voice messages.';
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
