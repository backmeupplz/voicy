function isRuChat(chat) {
  return (
    chat.engine === 'ashmanov' ||
    (chat.engine === 'wit' && chat.witLanguage === 'Russian') ||
    (chat.engine === 'google' && chat.googleLanguage === 'ru-RU')
  )
}

module.exports = {
  isRuChat,
}
