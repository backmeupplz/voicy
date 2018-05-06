/**
 * Used to get chat admins
 *
 * @module admins
 * @license MIT
 */

function getAdminIds(bot, chatId) {
  return new Promise((resolve, reject) => {
    bot.getChatAdministrators(chatId)
      .then((data) => {
        resolve(data.map(v => v.user.id));
      })
      .catch(err => reject(err));
  });
}

function isAdmin(bot, chatId, userId) {
  return new Promise((resolve, reject) => {
    getAdminIds(bot, chatId)
      .then((ids) => {
        resolve(ids.includes(userId));
      })
      .catch(err => reject(err));
  });
}

/** Exports */
module.exports = {
  getAdminIds,
  isAdmin,
};
