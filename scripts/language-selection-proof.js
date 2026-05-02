require('module-alias/register')

const assert = require('assert')

const handleSetLanguage = require('../dist/handlers/handleSetLanguage').default
const handleStart = require('../dist/commands/handleStart').default

function createContext({
  telegramLanguage = 'en',
  uiLanguage = 'en',
  manual = false,
} = {}) {
  const calls = []
  const dbchat = {
    uiLanguage,
    uiLanguageSelectedManually: manual,
    async save() {
      calls.push(['save', this.uiLanguage, this.uiLanguageSelectedManually])
      return this
    },
  }

  const i18n = {
    currentLocale: uiLanguage,
    locale(language) {
      if (language) {
        this.currentLocale = language
      }
      return this.currentLocale
    },
    t(key, replacements) {
      return `${this.currentLocale}:${key}:${replacements?.language || ''}`
    },
  }

  return {
    ctx: {
      timeReceived: new Date(),
      callbackQuery: { data: 'li~1~ru' },
      dbchat,
      i18n,
      editMessageText: async (text, options) =>
        calls.push(['edit', text, options]),
      answerCallbackQuery: async () => calls.push(['answerCallbackQuery']),
      reply: async (text, options) => calls.push(['reply', text, options]),
      msg: { message_id: 1 },
      from: { language_code: telegramLanguage },
      chat: { id: 1 },
    },
    calls,
  }
}

async function provesManualLanguageSurvivesStart() {
  const { ctx, calls } = createContext()

  await handleSetLanguage(ctx)

  assert.equal(ctx.dbchat.uiLanguage, 'ru')
  assert.equal(ctx.dbchat.uiLanguageSelectedManually, true)
  assert.deepEqual(calls[0], ['answerCallbackQuery'])
  assert.deepEqual(calls[1], ['save', 'ru', true])
  assert.equal(calls[2][0], 'edit')
  assert.equal(calls[2][1], 'ru:language_success:Русский')

  calls.length = 0

  await handleStart(ctx)

  assert.equal(ctx.dbchat.uiLanguage, 'ru')
  assert.equal(ctx.i18n.currentLocale, 'ru')
  assert.deepEqual(calls, [['reply', 'ru:start:', { parse_mode: 'Markdown' }]])
}

async function provesTelegramLanguageStillInitializesUnselectedChats() {
  const { ctx, calls } = createContext({
    telegramLanguage: 'ru',
    uiLanguage: 'en',
    manual: false,
  })

  await handleStart(ctx)

  assert.equal(ctx.dbchat.uiLanguage, 'ru')
  assert.equal(ctx.dbchat.uiLanguageSelectedManually, false)
  assert.deepEqual(calls[0], ['save', 'ru', false])
  assert.deepEqual(calls[1], ['reply', 'ru:start:', { parse_mode: 'Markdown' }])
}

Promise.resolve()
  .then(provesManualLanguageSurvivesStart)
  .then(provesTelegramLanguageStillInitializesUnselectedChats)
  .then(() => {
    console.log('language selection proof passed')
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
