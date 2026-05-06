require('module-alias/register')

const assert = require('assert')

const handleSetLanguage = require('../dist/handlers/handleSetLanguage').default
const handleStart = require('../dist/commands/handleStart').default
const {
  findUiLanguage,
  uiLanguageForTelegramCode,
  uiLanguages,
} = require('../dist/helpers/language/uiLanguages')
const languageKeyboard =
  require('../dist/helpers/language/languageKeyboard').default
const telegramAllowedUpdates =
  require('../dist/helpers/telegramAllowedUpdates').default

const languageCases = [
  ['en', 'English'],
  ['de', 'Deutsch'],
  ['es', 'Español'],
  ['pt', 'Português'],
  ['ru', 'Русский'],
  ['uk', 'Українська'],
]

function createContext({
  telegramLanguage = 'en',
  uiLanguage = 'en',
  selectedLanguage = 'ru',
  manual = false,
  editMessageText,
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
      callbackQuery: { data: `li~1~${selectedLanguage}` },
      dbchat,
      i18n,
      editMessageText:
        editMessageText ||
        (async (text, options) => calls.push(['edit', text, options])),
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

async function provesEverySupportedLanguageCanBeSelected() {
  for (const [code, name] of languageCases) {
    const { ctx, calls } = createContext({ selectedLanguage: code })

    await handleSetLanguage(ctx)

    assert.equal(ctx.dbchat.uiLanguage, code)
    assert.equal(ctx.dbchat.uiLanguageSelectedManually, true)
    assert.deepEqual(calls[0], ['answerCallbackQuery'])
    assert.deepEqual(calls[1], ['save', code, true])
    assert.equal(calls[2][0], 'edit')
    assert.equal(calls[2][1], `${code}:language_success:${name}`)
  }
}

function provesLanguageRegistryContainsExpectedLabels() {
  assert.deepEqual(
    uiLanguages.map(({ code, name }) => [code, name]),
    languageCases
  )

  for (const [code, name] of languageCases) {
    assert.equal(findUiLanguage(code).name, name)
    assert.equal(findUiLanguage(name).code, code)
  }
}

function provesTelegramLanguageCodesInitializeSupportedChats() {
  assert.equal(uiLanguageForTelegramCode('de').code, 'de')
  assert.equal(uiLanguageForTelegramCode('es-MX').code, 'es')
  assert.equal(uiLanguageForTelegramCode('pt-BR').code, 'pt')
  assert.equal(uiLanguageForTelegramCode('uk').code, 'uk')
  assert.equal(uiLanguageForTelegramCode('fr').code, 'en')
}

function provesRenderingLanguageKeyboardKeepsEnglishFallback() {
  languageKeyboard(true)

  assert.equal(uiLanguageForTelegramCode('fr').code, 'en')
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

async function provesLanguageCallbackFallsBackWhenEditFails() {
  const { ctx, calls } = createContext({
    editMessageText: async () => {
      calls.push(['editFailed'])
      throw new Error('message is not modified')
    },
  })

  const originalLog = console.log
  console.log = () => undefined
  try {
    await handleSetLanguage(ctx)
  } finally {
    console.log = originalLog
  }

  assert.equal(ctx.dbchat.uiLanguage, 'ru')
  assert.equal(ctx.dbchat.uiLanguageSelectedManually, true)
  assert.deepEqual(calls[0], ['answerCallbackQuery'])
  assert.deepEqual(calls[1], ['save', 'ru', true])
  assert.deepEqual(calls[2], ['editFailed'])
  assert.deepEqual(calls[3], [
    'reply',
    'ru:language_success:Русский',
    { parse_mode: 'Markdown' },
  ])
}

function provesRuntimePollsForCallbackQueries() {
  assert(telegramAllowedUpdates.includes('callback_query'))
}

Promise.resolve()
  .then(provesRuntimePollsForCallbackQueries)
  .then(provesLanguageRegistryContainsExpectedLabels)
  .then(provesTelegramLanguageCodesInitializeSupportedChats)
  .then(provesRenderingLanguageKeyboardKeepsEnglishFallback)
  .then(provesEverySupportedLanguageCanBeSelected)
  .then(provesManualLanguageSurvivesStart)
  .then(provesTelegramLanguageStillInitializesUnselectedChats)
  .then(provesLanguageCallbackFallsBackWhenEditFails)
  .then(() => {
    console.log('language selection proof passed')
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
