// Dependencies
const I18N = require('telegraf-i18n')
const { languages } = require('../helpers/stringsConstants')

const i18n = new I18N({
  directory: `${__dirname}/../locales`,
  defaultLanguage: 'en',
  sessionName: 'session',
  useSession: false,
  allowMissing: false,
})

function setupI18N(bot) {
  bot.use(i18n.middleware())
  bot.use((ctx, next) => {
    Object.keys(languages).forEach(engine => {
      if (engine === ctx.dbchat.engine) {
        let chatLang
        if (engine === 'wit') {
          chatLang = ctx.dbchat.witLanguage
        } else if (engine === 'google') {
          chatLang = ctx.dbchat.googleLanguage
        } else {
          chatLang = ctx.dbchat.yandexLanguage
        }
        const langs = languages[engine]
        const langCode = langs[chatLang] || 'en'
        ctx.i18n.locale(langCode)
        return next()
      }
    })
  })
}

module.exports = setupI18N
