#!/usr/bin/env node

require('reflect-metadata')
require('module-alias/register')

const assert = require('assert')

const handleHelp = require('../dist/commands/handleHelp').default
const handleStart = require('../dist/commands/handleStart').default

function createContext() {
  const calls = []
  const dbchat = {
    uiLanguage: 'en',
    uiLanguageSelectedManually: true,
    async save() {
      calls.push(['save'])
      return this
    },
  }

  return {
    ctx: {
      timeReceived: new Date(),
      dbchat,
      i18n: {
        locale() {
          return 'en'
        },
        t(key) {
          return `en:${key}`
        },
      },
      reply: async (text, options) => calls.push(['reply', text, options]),
      from: { language_code: 'en' },
      chat: { id: 1 },
      msg: { message_id: 1 },
    },
    calls,
  }
}

async function provesStartDisablesWebPreviews() {
  const { ctx, calls } = createContext()

  await handleStart(ctx)

  assert.deepEqual(calls, [
    [
      'reply',
      'en:start',
      { disable_web_page_preview: true, parse_mode: 'Markdown' },
    ],
  ])
}

async function provesHelpDisablesWebPreviews() {
  const { ctx, calls } = createContext()

  await handleHelp(ctx)

  assert.deepEqual(calls, [
    [
      'reply',
      'en:help',
      { disable_web_page_preview: true, parse_mode: 'Markdown' },
    ],
  ])
}

Promise.resolve()
  .then(provesStartDisablesWebPreviews)
  .then(provesHelpDisablesWebPreviews)
  .then(() => {
    console.log('start/help preview proof passed')
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
