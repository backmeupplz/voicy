// Dependencies
const I18N = require('telegraf-i18n')
const { updateLocale } = require('../helpers/language/languageConstants')

const i18n = new I18N({
  directory: `${__dirname}/../locales`,
  defaultLanguage: 'en',
  sessionName: 'session',
  useSession: false,
  allowMissing: true,
  skipPluralize: true,
  fallbackToDefaultLanguage: true,
})

function setupI18N(bot) {
  bot.use(i18n.middleware())
  bot.use((ctx, next) => {
    updateLocale(ctx)
    next()
  })
}

module.exports = setupI18N
