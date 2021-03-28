const fs = require('fs')

// Engine
//   code: string - no spaces engine code saved to db
//   name: string - human readable name of the engine
//   messageWhenEngineIsSet?: string - message to be sent when engine is picked
//   languages?: { code: string, name: string, i18nCode: string }[] — list of supported languages
//   recognize: (flacPath, chat, duration, ogaPath) => Promise([[timecode: string, text: string]]) — recognition function
//   languageForTelegramCode: (telegramCode: string) => string — function to return a language code when users first /start the bot
//   defaultLanguageCode: string — default language code to be used
//   languageException?: string — i18n key explaining why this engine doesn't have a language keyboard

const engines = fs
  .readdirSync(__dirname)
  .filter((n) => n !== 'index.js')
  .map((n) => require(`${__dirname}/${n}`))

module.exports = engines
