#!/usr/bin/env node

require('module-alias/register')

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

const { htmlI18n } = require('../dist/helpers/telegramMarkdown')

const locales = ['de', 'en', 'es', 'pt', 'ru', 'uk']
const localeDir = path.join(__dirname, '..', 'locales')
const allowedHtmlTags = new Set(['b', '/b', 'code', '/code'])

function localeMessages(locale) {
  return yaml.load(
    fs.readFileSync(path.join(localeDir, `${locale}.yaml`), 'utf8')
  )
}

function render(locale, key, replacements) {
  const messages = localeMessages(locale)
  return htmlI18n(
    {
      i18n: {
        t: (messageKey, data) =>
          Object.entries(data || {}).reduce(
            (text, [replacementKey, value]) =>
              text.replaceAll(`\${${replacementKey}}`, value),
            messages[messageKey]
          ),
      },
    },
    key,
    replacements
  )
}

function assertSupportedTelegramHtml(text, locale, key) {
  const tags = [...text.matchAll(/<\/?([A-Za-z0-9]+)>/g)].map(
    (match) => match[0].slice(1, -1)
  )
  const unsupportedTags = tags.filter((tag) => !allowedHtmlTags.has(tag))
  assert.deepEqual(
    unsupportedTags,
    [],
    `${locale}:${key} should only use supported Telegram HTML tags`
  )
}

function assertParagraphs(text, locale, key, count) {
  assert.equal(
    text.split(/\n\n+/).length,
    count,
    `${locale}:${key} should preserve ${count} paragraphs`
  )
}

for (const locale of locales) {
  const pay = render(locale, 'pay')
  assertParagraphs(pay, locale, 'pay', 4)
  assert(
    pay.includes('<code>/donate 15.69</code>'),
    `${locale}:pay should keep the custom donation example as a code span`
  )
  assert(
    pay.includes('<code>borodutch.eth</code>'),
    `${locale}:pay should keep the wallet address as a code span`
  )
  assert(
    !pay.includes('`'),
    `${locale}:pay should not rely on Markdown code spans`
  )
  assertSupportedTelegramHtml(pay, locale, 'pay')

  const custom = render(locale, 'pay_custom', { amount: '<$7.00&>' })
  assertParagraphs(custom, locale, 'pay_custom', 2)
  assert(
    custom.includes('&lt;$7.00&amp;&gt;'),
    `${locale}:pay_custom should HTML-escape replacement values`
  )
  assertSupportedTelegramHtml(custom, locale, 'pay_custom')

  const amountTooLow = render(locale, 'pay_amount_too_low', {
    amount: '<$6.99&>',
  })
  assertParagraphs(amountTooLow, locale, 'pay_amount_too_low', 2)
  assert(
    amountTooLow.includes('<code>/donate &lt;$6.99&amp;&gt;</code>'),
    `${locale}:pay_amount_too_low should keep the command as a code span and escape replacements`
  )
  assertSupportedTelegramHtml(amountTooLow, locale, 'pay_amount_too_low')
}

const englishPay = render('en', 'pay')
assert.equal(
  englishPay,
  [
    'Voicy turns audio into text using local compute. That keeps transcription private and avoids sending your audio to third-party transcription APIs.',
    'Running local compute costs money. A one-time donation activates Voicy for this chat and helps us add more compute capacity.',
    'Donations are per chat, not per user. If you donate in private messages with Voicy, it activates Voicy in your private chat. If you want to activate a group, run /donate inside that group.',
    'Choose a Telegram Stars tier below. Stripe checkout is still available, or send <code>/donate 15.69</code> to pay any amount with a $6.99 minimum. You can also send tokens worth at least $6.99 to <code>borodutch.eth</code> and send the transaction to @borodutch.\n',
  ].join('\n\n'),
  'English donation copy should match the approved wording'
)

console.log('donation formatting proof passed')
