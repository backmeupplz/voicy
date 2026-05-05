#!/usr/bin/env node

require('module-alias/register')

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const {
  escapeTelegramMarkdownText,
} = require('../dist/helpers/telegramMarkdown')

assert.equal(
  escapeTelegramMarkdownText('@golden_borodutch_chat'),
  '@golden\\_borodutch\\_chat',
  'underscore-bearing bot usernames should be escaped for Telegram Markdown'
)

assert.equal(
  escapeTelegramMarkdownText('@golden\\_borodutch\\_chat'),
  '@golden\\_borodutch\\_chat',
  'already escaped usernames should stay stable'
)

assert.equal(
  escapeTelegramMarkdownText('`@golden_borodutch_chat`'),
  '`@golden_borodutch_chat`',
  'code spans should not be rewritten by Markdown escaping'
)

for (const locale of ['en', 'ru']) {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'locales', `${locale}.yaml`),
    'utf8'
  )

  assert(
    source.includes('@golden\\_borodutch\\_chat'),
    `${locale} start/help copy should include escaped Golden Borodutch support chat`
  )

  assert(
    !source.includes('@golden_borodutch_chat'),
    `${locale} locale should not contain bare support chat username`
  )
}

console.log('telegram markdown proof passed')
