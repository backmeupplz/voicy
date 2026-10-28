#!/usr/bin/env node

require('module-alias/register')
require('reflect-metadata')

const assert = require('assert')
const { createHash } = require('crypto')
const fs = require('fs')
const path = require('path')

const {
  breach,
  byLang,
  draw,
  message,
  unitOf,
} = require('../dist/helpers/broadcast')

// Prime Radiant's bc1 as the go service serves it (go/campaigns.json)
const cfg = {
  id: 'bc1',
  bot: 'voicy',
  status: 'running',
  target: 'https://t.me/videodownloadbot',
  payload: 'bc1-a-voicy',
  audience: { chats: 'private', langs: ['en', 'ru'], active_days: [30, 180] },
  size: 3,
  holdout: 2,
  rate: 25,
  check_every: 500,
  stop: { blocks_over_holdout: 0.01, blocks: 0.015, optouts: 0.03 },
  text: { en: 'Hi! Nikita here.', ru: 'Привет! Это Никита.' },
  button: { en: 'Open VideoDownloadBot', ru: 'Открыть VideoDownloadBot' },
  optout: { en: "Don't send me news", ru: 'Не присылать новости' },
  optout_done: { en: 'Done.', ru: 'Готово.' },
}

// The draw is fixed by the chat ids alone, whatever order they come in
const chats = Array.from({ length: 10 }, (_, i) => ({
  chatId: String(1000 + i),
  lang: i % 2 ? 'ru' : 'en',
}))
const a = draw('bc1', chats, 3, 2)
const b = draw('bc1', chats.slice().reverse(), 3, 2)
assert.deepStrictEqual(a, b)
assert.equal(a.treatment.length, 3)
assert.equal(a.holdout.length, 2)
const rank = (id) => createHash('sha256').update(`bc1:${id}`).digest('hex')
const expected = chats.map((c) => c.chatId).sort((x, y) => (rank(x) < rank(y) ? -1 : 1))
assert.deepStrictEqual(
  [...a.treatment, ...a.holdout].map((c) => c.chatId),
  expected.slice(0, 5)
)
assert.equal(draw('bc1', chats.slice(0, 2), 3, 2).holdout.length, 0)

const langs = byLang(
  [{ lang: 'en' }, { lang: 'ru', arm: 'holdout' }, { lang: 'en' }],
  ['en', 'ru', 'es']
)
assert.deepStrictEqual(langs, {
  en: { treatment: 2, holdout: 0 },
  ru: { treatment: 0, holdout: 1 },
  es: { treatment: 0, holdout: 0 },
})

// The exact text, a native deep link and the opt-out button; unknown languages get English
const ru = message(cfg, 'ru')
assert.equal(ru.text, 'Привет! Это Никита.')
assert.equal(ru.other.parse_mode, 'HTML')
assert.equal(ru.other.disable_web_page_preview, true)
assert.deepStrictEqual(ru.other.reply_markup.inline_keyboard, [
  [
    {
      text: 'Открыть VideoDownloadBot',
      url: 'https://t.me/videodownloadbot?start=bc1-a-voicy',
    },
  ],
  [{ text: 'Не присылать новости', callback_data: 'bco:bc1' }],
])
assert.equal(message(cfg, 'de').text, 'Hi! Nikita here.')

// Stop rules: unreachable chats never count, only delivered messages do
const n = (o) => ({
  treatment: 2000,
  holdout: 2000,
  sent: 500,
  unreachable: 300,
  failed: 0,
  blocked_t: 0,
  blocked_h: 0,
  optout: 0,
  ...o,
})
assert.equal(breach(cfg, n({})), undefined)
assert.equal(breach(cfg, n({ sent: 0 })), undefined)
assert.equal(breach(cfg, n({ blocked_t: 4, blocked_h: 10 })), undefined) // 0.8% vs 0.5%
assert.match(breach(cfg, n({ blocked_t: 6, blocked_h: 2 })), /against the holdout/) // 1.2% vs 0.1%
assert.match(breach(cfg, n({ blocked_t: 8, blocked_h: 40 })), /limit 1.5%/) // 1.6% outright
assert.match(breach(cfg, n({ optout: 15 })), /opt-outs 3.0%/)

// The same salted hash promoStart.ts and VideoDownloadBot use
assert.equal(
  unitOf('tok', 'bc1', '42'),
  createHash('sha256').update('tok:bc1:42').digest('hex').slice(0, 16)
)

// The sender starts only with polling and stops before it is handed over
const app = fs.readFileSync(path.join(__dirname, '../src/app.ts'), 'utf8')
assert.match(app, /startBroadcasts\(bot\.api\)/)
assert.ok(app.indexOf('await stopBroadcasts()') < app.indexOf('await runner?.stop()'))

console.log('broadcast proof passed')
