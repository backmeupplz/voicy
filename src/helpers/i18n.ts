import { I18n } from '@grammyjs/i18n'

const i18n = new I18n({
  defaultLanguageOnMissing: true,
  directory: `${__dirname}/../../locales`,
  defaultLanguage: 'en',
})

export default i18n
