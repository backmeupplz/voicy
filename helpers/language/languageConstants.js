const engines = require('../../engines')

function localeForChat(chat) {
  const engineObject = engines.find((e) => e.code === chat.engine)
  const language = chat[`${chat.engine}Language`]
  const languageObject = engineObject.languages.find((l) => l.code === language)
  return languageObject.i18nCode
}

function updateLocale(ctx) {
  ctx.i18n.locale(localeForChat(ctx.dbchat))
}

function languageString(languageCode, engine) {
  const engineObject = engines.find((e) => e.code === engine)
  const language = engineObject.languages.find((l) => l.code === languageCode)
  return language.name
}

// Exports
module.exports = {
  updateLocale,
  languageString,
}
