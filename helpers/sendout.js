/**
 * Used to send messages to all users
 *
 * @module sendout
 * @license MIT
 */

/** Dependencies */

const db = require('./db');
const config = require('../config');

/**
 * Used to send messages to all chats
 * @param {Telegram:Bot} bot Bot that should send messages
 * @param {String} text Text to be sent
 */
function sendAll(bot, text) {
  db.countChats()
    .then((count) => {
      sendMessage(text, bot, {}, 0, count);
      bot.sendMessage(config.admin_id, `Sendout started! # of chats is ${count}`);
    })
    .catch(err => bot.sendMessage(config.admin_id, `Sendout failed:\n${err}`));
}

let startSendout = false;
/**
 * Recursive function to send text to an array of chats; please don't use this
 *    function twice at any given point of time. Sends at most 30 messages/sec
 *
 * @param {String} text - Text to be sent
 * @param {[Mongoose:Chat]} chats - Chats to get this message
 * @param  {Telegram:Bot} bot - Bot that should respond
 */
function sendMessage(text, bot, results, index, total) {
  if (index >= total) {
    const keys = Object.keys(results);
    const successKeyIndex = keys.indexOf('success');
    if (successKeyIndex > -1) {
      keys.splice(successKeyIndex, 1);
    }
    let message = `All messages were sent, here are the results:\n\nSuccess: ${results.success || 0}`;

    keys.forEach((key) => {
      message = `${message}\n${key}: ${results[key]}`;
    });

    bot.sendMessage(config.admin_id, message);
    return;
  }

  /** Get current users and users for the next loop */
  db.getChats()
    .skip(index)
    .limit(30)
    .then((chats) => {
      const promises = [];
      chats.forEach((user) => {
        if (!startSendout) {
          console.log(`tried ${index}, already sent`);
        }
        if (!startSendout) {
          // if (user.id == 232242904) {
            startSendout = true;
          // }
        }
        if (startSendout) {
          promises.push(new Promise((resolve) => {
            console.log(`current results (${user.id}, ${index}): ${JSON.stringify(results)}`);
            bot.sendMessage(user.id, text, {
              disable_web_page_preview: 'true',
            })
              .then(() => { resolve('success'); })
              .catch((err) => { resolve(String(err.message)); });
          }));
        }
      });
      Promise.all(promises)
        .then((values) => {
          values.forEach((value) => {
            if (results[value]) {
              results[value] += 1;
            } else {
              results[value] = 1;
            }
          });
          if (startSendout) {
            setTimeout(() => {
              sendMessage(text, bot, results, index + 30, total);
            }, 1500);
          } else {
            sendMessage(text, bot, results, index + 30, total);
          }
        })
        .catch(err => bot.sendMessage(config.admin_id, err.message));
    })
    .catch((err) => {
      if (err.message.includes('group chat was migrated')) {
        err.message = 'group chat was migrated to sueprgroup';
      }
      if (results[String(err.message)]) {
        results[String(err.message)] += 1;
      } else {
        results[String(err.message)] = 1;
      }
      setTimeout(() => {
        sendMessage(text, bot, results, index + 30, total);
      }, 1500);
    });
}

module.exports = {
  sendAll,
};
