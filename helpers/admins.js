/**
 * Getting admin ids of a chat
 * @param {Telegraf:Telegram} bot Bot to make a query
 * @param {Number} chatId ID of the chat to check
 */
function getAdminIds(bot, chatId) {
  return new Promise((resolve, reject) => {
    bot.getChatAdministrators(chatId)
      .then((data) => {
        resolve(data.map(v => v.user.id))
      })
      .catch(err => reject(err))
  })
}

/**
 * Checking if ID is user at a chat
 * @param {Telegraf:Telegram} bot Bot that should make the query
 * @param {Number} chatId Chat that is getting checked
 * @param {Number} userId User that is getting checked for being an admin
 */
function isAdmin(bot, chatId, userId) {
  return new Promise((resolve, reject) => {
    getAdminIds(bot, chatId)
      .then((ids) => {
        resolve(ids.includes(userId))
      })
      .catch(err => reject(err))
  })
}

// Exports
module.exports = {
  getAdminIds,
  isAdmin,
}
