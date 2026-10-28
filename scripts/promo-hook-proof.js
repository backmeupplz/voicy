#!/usr/bin/env node

require('module-alias/register')
require('reflect-metadata')

const assert = require('assert')

const promo = require('../dist/helpers/promo')
const { replyWithPromo } = require('../dist/helpers/promoHost')
const { campaignInviteLinkNames } = require('../dist/helpers/promoStart')

const cfg = {
  base: 'https://lumen.borodutch.com/go',
  bots: { voicy: { enabled: true, code: 'voicy' }, banofbot: { enabled: true, code: 'ban' } },
  campaigns: [
    {
      id: 'tp1',
      bot: 'voicy',
      status: 'running',
      target: 'https://t.me/videodownloadbot',
      chats: ['private'],
      cap_days: 7,
      langs: ['en', 'ru'],
      text: { en: 'Videos from links', ru: 'Видео по ссылкам' },
      variants: [
        { id: 'a', share: 0.1, format: 'caption' },
        { id: 'b', share: 0.1, format: 'button', text: { en: 'Btn', ru: 'Кн' } },
      ],
    },
  ],
}
const c = cfg.campaigns[0]
const inArm = (id) => {
  for (let u = 1000; ; u++) if ((promo.arm(c, u) || { id: undefined }).id === id) return u
}

async function main() {
  // a caption line in legacy Markdown, a button under the message
  const a = promo.decide(cfg, 'voicy', 's', inArm('a'), 'private', 'pt-br', undefined)
  assert.equal(a, null) // no Portuguese text in this campaign
  const p = promo.decide(cfg, 'voicy', 's', inArm('a'), 'private', 'en', undefined).promo
  assert.equal(promo.markdown(p), '\n\n[Videos from links](https://t.me/videodownloadbot?start=tp1-a-voicy)')
  const b = promo.decide(cfg, 'voicy', 's', inArm('b'), 'private', 'ru', undefined).promo
  assert.deepEqual(promo.keyboard(b).inline_keyboard, [[{ text: 'Кн', url: 'https://t.me/videodownloadbot?start=tp1-b-voicy' }]])
  assert.equal(promo.markdown(b), '')
  // never in groups
  assert.equal(promo.decide(cfg, 'voicy', 's', inArm('a'), 'supergroup', 'en', undefined), null)

  // replyWithPromo: groups never ask for a promo; without a config nothing is added
  const replies = []
  const ctx = (type) => ({
    chat: { type },
    from: { id: inArm('a'), language_code: 'en' },
    dbchat: { uiLanguage: 'en' },
    reply: async (text, extra) => void replies.push({ text, extra }),
  })
  await replyWithPromo(ctx('group'), 'Hi')
  await replyWithPromo(ctx('private'), 'Hello')
  assert.deepEqual(replies.map((r) => r.text), ['Hi', 'Hello'])
  assert.equal(replies[1].extra.parse_mode, 'Markdown')
  assert.equal(replies[1].extra.reply_markup, undefined)

  // invite links the channel campaigns need
  const channel = {
    ...c,
    id: 'tp2',
    bot: 'banofbot',
    status: 'paused',
    target: 'https://t.me/golden_borodutch',
    variants: [
      { id: 'a', share: 0.1, format: 'caption' },
      { id: 'b', share: 0.1, format: 'button', target: 'https://t.me/+Already' },
    ],
  }
  assert.deepEqual(
    campaignInviteLinkNames({ ...cfg, campaigns: [c, channel, { ...channel, id: 'tp3', status: 'stopped' }] }),
    ['tp2-a-ban']
  )
  assert.deepEqual(campaignInviteLinkNames(undefined), [])
  console.log('promo hook proof passed')
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
