// Dependencies
const Localize = require('localize')
const { localizations, languages } = require('./stringsConstants')

/**
 * Function to set language for this locale
 * @param {Mongoose:Chat} chat Chat which language should be set
 */
Localize.prototype.setChat = function setChat(chat) {
  Object.keys(languages).forEach((engine) => {
    if (engine === chat.engine) {
      let chatLang
      if (engine === 'wit') {
        chatLang = chat.witLanguage
      } else if (engine === 'google') {
        chatLang = chat.googleLanguage
      } else {
        chatLang = chat.yandexLanguage
      }
      const langs = languages[engine]
      this.setLocale(langs[chatLang] || 'en')
    }
  })
}

/**
 * Function to get localizing software
 * @returns localizing object
 */
function localize() {
  return {
    translate: arg => arg,
    setChat: () => {},
  }
  // return new Localize(localizations)
}

// Exports
module.exports = localize
