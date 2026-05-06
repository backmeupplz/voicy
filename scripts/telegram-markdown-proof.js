#!/usr/bin/env node

require('module-alias/register')

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const {
  escapeTelegramMarkdownText,
} = require('../dist/helpers/telegramMarkdown')

const retiredBotUsername = ['@voicy', 'legacy', 'bot'].join('_')
const escapedRetiredBotUsername = retiredBotUsername.replace(/_/g, '\\_')
const removedSupportChatUsername = ['@golden', 'borodutch', 'chat'].join('_')
const escapedRemovedSupportChatUsername = removedSupportChatUsername.replace(
  /_/g,
  '\\_'
)

assert.equal(
  escapeTelegramMarkdownText('@golden_borodutch'),
  '@golden\\_borodutch',
  'underscore-bearing bot usernames should be escaped for Telegram Markdown'
)

assert.equal(
  escapeTelegramMarkdownText('@golden\\_borodutch'),
  '@golden\\_borodutch',
  'already escaped usernames should stay stable'
)

assert.equal(
  escapeTelegramMarkdownText('`@golden_borodutch`'),
  '`@golden_borodutch`',
  'code spans should not be rewritten by Markdown escaping'
)

for (const locale of ['de', 'en', 'es', 'pt', 'ru', 'uk']) {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'locales', `${locale}.yaml`),
    'utf8'
  )

  assert(
    source.includes('@golden\\_borodutch'),
    `${locale} locale should keep escaped Golden Borodutch channel references`
  )

  assert(
    source.includes('stripe_activation_confirmed:'),
    `${locale} locale should include Stripe activation confirmation copy`
  )

  assert(
    !source.includes('@golden_borodutch'),
    `${locale} locale should not contain bare Golden Borodutch usernames`
  )

  assert(
    !source.includes(escapedRetiredBotUsername) &&
      !source.includes(retiredBotUsername),
    `${locale} locale should not mention the retired bot`
  )

  assert(
    !source.includes(escapedRemovedSupportChatUsername) &&
      !source.includes(removedSupportChatUsername),
    `${locale} locale should not mention the removed help chat`
  )
}

console.log('telegram markdown proof passed')
