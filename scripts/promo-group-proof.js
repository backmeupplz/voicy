#!/usr/bin/env node
// Group promos (approvals.md 2026-11-06, agentboard #477): the topic matcher,
// the group hook (cap, /promos off, removed and optout events, no text sent)
// and the button on a group transcription. Runs on dist/ (tsc first).

require('module-alias/register')
require('reflect-metadata')

const assert = require('assert')

function mockModule(path, exports) {
  require.cache[path] = { id: path, filename: path, loaded: true, exports }
}

const cfg = {
  base: 'https://lumen.borodutch.com/go',
  bots: { voicy: { enabled: true, code: 'voicy' } },
  campaigns: [
    {
      id: 'tp8',
      bot: 'voicy',
      status: 'running',
      target: 'https://t.me/jev_antispam_bot',
      chats: ['private'],
      cap_days: 14,
      langs: ['en'],
      text: { en: 'Jev' },
      variants: [{ id: 'a', share: 0.05, format: 'button', text: { en: 'Jev' } }],
    },
    {
      id: 'gp1',
      bot: 'voicy',
      status: 'running',
      target: 'https://t.me/videodownloadbot',
      chats: ['group'],
      cap_days: 7,
      langs: ['en', 'ru'],
      text: { en: 'Videos', ru: 'Видео' },
      variants: [{ id: 'a', share: 0.25, format: 'button', text: { en: '🎬 Download videos from links', ru: '🎬 Скачать видео' } }],
      topics: { en: ['download', 'youtu.be'], ru: ['скача'] },
    },
  ],
}

async function provesTheHook() {
  // axios stands in for the network: the salt, the config, the event batches
  // and the go service's cap across bots (POST /go/group: one claim per group
  // hash per 7 days, whichever bot)
  const sent = []
  const claims = new Map()
  const capBodies = []
  let capDown = false
  mockModule(require.resolve('axios'), {
    __esModule: true,
    default: {
      get: async (url) => ({ data: url.includes('/salt?bot=voicy') ? { salt: 'S' } : cfg }),
      post: async (url, body) => {
        if (!url.endsWith('/go/group')) return void sent.push({ url, body })
        if (capDown) throw new Error('Request failed with status code 502')
        capBodies.push(body)
        const held = claims.get(body.g)
        if (body.k === 'release') {
          if (held === body.at) claims.delete(body.g)
          return { data: { ok: true } }
        }
        if (held !== undefined) return { data: { ok: false, at: held } }
        const at = Date.now()
        claims.set(body.g, at)
        return { data: { ok: true, at } }
      },
    },
  })
  delete require.cache[require.resolve('../dist/helpers/promo')]
  const promo = require('../dist/helpers/promo')
  const c = cfg.campaigns[1]
  const group = (id, from = -1001000000000) => {
    for (let g = from; ; g--) if ((promo.groupArm(c, 'S', g) || { id: 'holdout' }).id === id) return g
  }

  assert.equal(promo.topical('Скачай мне это видео', c.topics), true)
  assert.equal(promo.topical('see https://youtu.be/abc', c.topics), true)
  assert.equal(promo.topical('nothing here, predownload', c.topics), false)
  assert.equal(promo.chatKind('supergroup'), 'group')
  // the private path never serves a group, the group path never a private chat
  assert.equal(promo.decide(cfg, 'voicy', 'S', 5, 'supergroup', 'en', undefined), null)
  assert.equal(promo.decideGroup(cfg, 'voicy', 'S', group('a'), 'de', 'download', undefined), null)

  const map = new Map()
  const store = { get: async (k) => map.get(k), set: async (k, v) => void map.set(k, v) }
  const h = promo.promos('voicy', store, { PROMO_TOKEN: 't' })
  await h.refresh()
  const a = group('a')
  const ho = group('holdout')
  const secret = 'please download the secret video'
  assert.equal(await h.group(a, 'private', 'en', secret), null)
  assert.equal(await h.group(a, 'supergroup', 'en', 'off topic'), null)
  const d = await h.group(a, 'supergroup', 'en', secret)
  assert.deepEqual(d.promo, {
    text: '🎬 Download videos from links',
    url: 'https://t.me/videodownloadbot?start=gp1-a-voicy',
    format: 'button',
  })
  await h.record(d)
  assert.equal((await h.group(a, 'supergroup', 'en', secret)).promo, undefined) // once per 7 days
  await h.record(await h.group(ho, 'group', 'en', secret))
  const other = group('a', a - 1)
  assert.equal(await h.setGroup(other, false), true)
  assert.equal(await h.groupOn(other), false)
  assert.equal(await h.group(other, 'supergroup', 'en', secret), null)
  // the cap holds across bots: a group another bot claimed this week gets no
  // button (still seen); the service down means no button either, and a reply
  // without the button releases Voicy's claim
  const third = group('a', other - 1)
  claims.set(promo.groupKey('S', third), Date.now() - 86400_000)
  const taken = await h.group(third, 'supergroup', 'en', secret)
  assert.equal(taken.arm, 'a')
  assert.equal(taken.promo, undefined)
  const fourth = group('a', third - 1)
  capDown = true
  assert.equal((await h.group(fourth, 'supergroup', 'en', secret)).promo, undefined)
  capDown = false
  const mine = await h.group(fourth, 'supergroup', 'en', secret)
  assert(mine.promo, 'the claim goes through once the service answers')
  assert(claims.has(promo.groupKey('S', fourth)))
  await h.record(mine, false)
  await new Promise((resolve) => setImmediate(resolve))
  assert(!claims.has(promo.groupKey('S', fourth)), 'released')
  assert(capBodies.every((b) => Object.keys(b).every((k) => ['g', 'k', 'at'].includes(k))))
  assert.deepEqual(h.matches('download it'), ['gp1'])
  assert.deepEqual(h.matches('off topic'), [])
  await h.removed(a)
  await h.removed(-5) // never seen
  await h.flush()
  const events = sent.at(-1).body.events
  assert.deepEqual(
    events.map((e) => `${e.c}:${e.v}:${e.k}`),
    ['gp1:a:seen', 'gp1:a:shown', 'gp1:holdout:seen', 'gp1:a:optout', 'gp1:a:seen', 'gp1:a:removed']
  )
  const wire = JSON.stringify(sent) + JSON.stringify(capBodies)
  assert(!wire.includes('secret') && !wire.includes(String(a).slice(1)), 'no text or group id leaves the bot')
  assert(![...map.values()].join().includes('secret'), 'no text in the store')

  // the store fails after the button went out: seen and shown still go out
  let down = false
  const flaky = {
    get: async (k) => (down ? Promise.reject(new Error('db down')) : map.get(k)),
    set: async (k, v) => (down ? Promise.reject(new Error('db down')) : void map.set(k, v)),
  }
  const h2 = promo.promos('voicy', flaky, { PROMO_TOKEN: 't' })
  await h2.refresh()
  const fresh = group('a', fourth - 1)
  const d2 = await h2.group(fresh, 'supergroup', 'en', secret)
  assert(d2.promo)
  down = true
  await h2.record(d2)
  await h2.flush()
  assert.deepEqual(
    sent.at(-1).body.events.map((e) => `${e.c}:${e.v}:${e.k}`),
    ['gp1:a:seen', 'gp1:a:shown']
  )
}

async function provesTheButtonOnGroupTranscriptions() {
  const calls = []
  const asked = []
  const recorded = []
  const released = []
  let decision = null
  mockModule(require.resolve('../dist/helpers/promoHost'), {
    promoHook: {
      group: async (...args) => {
        asked.push(args)
        return decision
      },
      record: async (d, shown) => void recorded.push([d, shown]),
      release: (d) => void released.push(d),
    },
  })
  mockModule(require.resolve('../dist/helpers/bot'), {
    __esModule: true,
    default: {
      api: {
        editMessageText: async (...args) => void calls.push(['edit', ...args]),
        sendMessage: async (...args) => void calls.push(['send', ...args]),
        deleteMessage: async () => undefined,
      },
    },
  })
  mockModule(require.resolve('../dist/models/Voice'), { VoiceModel: { findOneAndUpdate: async () => ({}) } })
  mockModule(require.resolve('../dist/models/Chat'), { ChatModel: { findOneAndUpdate: async () => ({}) } })
  mockModule(require.resolve('../dist/models/TranscriptionJob'), {
    activeTranscriptionJobStatuses: [],
    TranscriptionJobStatus: { failed: 'failed' },
    TranscriptionJobModel: { updateMany: async () => ({ modifiedCount: 0 }) },
  })
  delete require.cache[require.resolve('../dist/helpers/chatReachability')]
  const publisher = require.resolve('../dist/helpers/transcriptionJobs/publishCompletedTranscriptionJob')
  delete require.cache[publisher]
  const publish = require(publisher).default
  const button = {
    campaign: 'gp1',
    arm: 'a',
    unit: '0123456789abcdef',
    promo: { text: 'Videos', url: 'https://t.me/videodownloadbot?start=gp1-a-voicy', format: 'button' },
  }
  const job = (over) => ({
    chatId: 'c1',
    telegramChatId: '-1001',
    telegramChatType: 'supergroup',
    uiLocale: 'en',
    sourceMessageId: 7,
    statusMessageId: 8,
    resultText: 'can you download this',
    ...over,
  })

  // one message: the edited status message carries the button
  decision = button
  await publish(job())
  assert.deepEqual(asked.at(-1), [-1001, 'supergroup', 'en', 'can you download this'])
  assert.deepEqual(calls.at(-1), [
    'edit',
    '-1001',
    8,
    'can you download this',
    { reply_markup: { inline_keyboard: [[{ text: 'Videos', url: button.promo.url }]] } },
  ])
  assert.deepEqual(recorded.at(-1), [button, true])

  // a long transcript: only the last message carries it
  calls.length = 0
  await publish(job({ statusMessageId: undefined, resultText: 'download '.repeat(1000) }))
  assert(calls.length >= 2)
  assert(calls.slice(0, -1).every((c) => !c[3].reply_markup))
  assert.deepEqual(calls.at(-1)[3].reply_markup.inline_keyboard[0][0].url, button.promo.url)
  assert.equal(calls.at(-1)[3].reply_to_message_id, 7)
  assert.deepEqual(recorded.at(-1), [button, true])

  // the holdout (or no match): the reply goes out exactly as before, seen is recorded
  calls.length = 0
  decision = { campaign: 'gp1', arm: 'holdout', unit: '0123456789abcdef' }
  await publish(job())
  assert.deepEqual(calls, [['edit', '-1001', 8, 'can you download this']])
  assert.deepEqual(recorded.at(-1), [decision, true])
  decision = null
  await publish(job({ telegramChatType: 'private', telegramChatId: '55' }))
  assert.deepEqual(calls.at(-1), ['edit', '55', 8, 'can you download this'])
  assert.deepEqual(recorded.at(-1), [null, true])

  // guest mode never asks for a promo, even without an inline message id
  decision = button
  const before = asked.length
  await publish(job({ guestQueryId: 'q1' }))
  assert.equal(asked.length, before)
  assert.deepEqual(recorded.at(-1), [null, true])
  assert(!calls.at(-1)[4], 'no button in guest mode')

  // the reply couldn't be sent at all: released, never recorded
  const api0 = require.cache[require.resolve('../dist/helpers/bot')].exports.default.api
  const send0 = api0.sendMessage
  api0.sendMessage = async () => {
    const error = new Error('Bad Request: not enough rights to send text messages to the chat')
    error.error_code = 400
    error.description = 'Bad Request: not enough rights to send text messages to the chat'
    throw error
  }
  const recordedBefore = recorded.length
  await assert.rejects(() => publish(job({ statusMessageId: undefined })), /not enough rights/)
  assert.equal(released.at(-1), button)
  assert.equal(recorded.length, recordedBefore)
  api0.sendMessage = send0

  // the edit fails harmlessly: no button went out, so it's not counted as shown
  decision = button
  const api = require.cache[require.resolve('../dist/helpers/bot')].exports.default.api
  api.editMessageText = async () => {
    const error = new Error('Bad Request: message is not modified')
    error.error_code = 400
    error.description = 'Bad Request: message is not modified'
    throw error
  }
  await publish(job())
  assert.deepEqual(recorded.at(-1), [button, false])
  api.editMessageText = async (...args) => void calls.push(['edit', ...args])

  // Telegram refuses the button (a 400 that isn't an unreachable chat): the
  // same message goes out once more without it, never blocked, never shown
  const refuse = (fn) => async (...args) => {
    if (args.some((a) => a && a.reply_markup)) {
      const error = new Error('Bad Request: BUTTON_URL_INVALID')
      error.error_code = 400
      error.description = 'Bad Request: BUTTON_URL_INVALID'
      throw error
    }
    return fn(...args)
  }
  const edit0 = api.editMessageText
  api.sendMessage = refuse(send0)
  api.editMessageText = refuse(edit0)
  const releasedBefore = released.length

  // the edited status message
  calls.length = 0
  await publish(job())
  assert.deepEqual(calls, [['edit', '-1001', 8, 'can you download this']])
  assert.deepEqual(recorded.at(-1), [button, false])

  // a sent reply: still a reply, without the button
  calls.length = 0
  await publish(job({ statusMessageId: undefined }))
  assert.deepEqual(calls, [['send', '-1001', 'can you download this', { reply_to_message_id: 7 }]])
  assert.deepEqual(recorded.at(-1), [button, false])

  // a long transcript: every chunk goes out, the last one without the button
  calls.length = 0
  await publish(job({ statusMessageId: undefined, resultText: 'download '.repeat(1000) }))
  assert(calls.length >= 2)
  assert(calls.every((c) => c[0] === 'send' && !c[3].reply_markup && c[3].reply_to_message_id === 7))
  assert.deepEqual(recorded.at(-1), [button, false])
  assert.equal(released.length, releasedBefore)

  // a refused edit, then the edit without it fails too: a new message, no button
  api.editMessageText = async (...args) => {
    const error = new Error('Bad Request: message to edit not found')
    error.error_code = 400
    error.description = 'Bad Request: message to edit not found'
    if (args[3] && args[3].reply_markup) {
      error.message = error.description = 'Bad Request: BUTTON_URL_INVALID'
    }
    throw error
  }
  calls.length = 0
  await publish(job())
  assert.deepEqual(calls, [['send', '-1001', 'can you download this', { reply_to_message_id: 7 }]])
  assert.deepEqual(recorded.at(-1), [button, false])
  api.sendMessage = send0
  api.editMessageText = edit0
}

async function provesThePromosCommandAndRemovals() {
  const changes = []
  const removed = []
  let on = true
  mockModule(require.resolve('../dist/helpers/promoHost'), {
    promoHook: {
      groupOn: async () => on,
      setGroup: async (chat, value) => {
        changes.push([chat, value])
        return true
      },
      removed: async (chat) => void removed.push(chat),
      blocked: () => undefined,
    },
  })
  mockModule(require.resolve('../dist/helpers/chatReachability'), { markChatReachable: async () => undefined })
  mockModule(require.resolve('../dist/helpers/broadcast'), { recordBroadcastBlock: async () => undefined })
  mockModule(require.resolve('../dist/helpers/language/sendLanguage'), { __esModule: true, default: async () => undefined })
  for (const m of ['../dist/commands/handlePromos', '../dist/handlers/handleMyChatMember']) delete require.cache[require.resolve(m)]
  const handlePromos = require('../dist/commands/handlePromos').default
  const handleMyChatMember = require('../dist/handlers/handleMyChatMember').default

  const ctx = ({ type = 'supergroup', match = '', status = 'member', username, senderChat, throws } = {}) => {
    const replies = []
    return {
      replies,
      chat: { id: -100, type },
      from: { id: 9, username },
      senderChat,
      match,
      i18n: { t: (key) => key },
      getChatMember: async () => {
        if (throws) throw new Error('Bad Request: user not found')
        return { status }
      },
      reply: async (text) => void replies.push(text),
    }
  }
  const run = async (opts) => {
    const c = ctx(opts)
    await handlePromos(c)
    return c.replies
  }
  assert.deepEqual(await run({ type: 'private', match: 'off' }), ['error_group'])
  assert.deepEqual(await run({ type: 'channel', match: 'off' }), ['error_group'])
  assert.deepEqual(await run({}), ['promos_status_on'])
  on = false
  assert.deepEqual(await run({}), ['promos_status_off'])
  on = undefined // the store couldn't be read
  assert.deepEqual(await run({}), ['promos_error'])
  assert.deepEqual(await run({ match: 'off' }), ['promos_admins_only'])
  assert.deepEqual(await run({ match: 'off', throws: true }), ['promos_admins_only']) // posting as a channel
  assert.deepEqual(changes, [])
  assert.deepEqual(await run({ match: ' OFF ', status: 'administrator' }), ['promos_off'])
  assert.deepEqual(await run({ match: 'on', status: 'creator' }), ['promos_on'])
  assert.deepEqual(await run({ match: 'off', username: 'GroupAnonymousBot' }), ['promos_off'])
  assert.deepEqual(await run({ match: 'off', senderChat: { id: -100 } }), ['promos_off'])
  assert.deepEqual(changes, [[-100, false], [-100, true], [-100, false], [-100, false]])

  // my_chat_member: left or kicked in a group reports removed; joining or a private block doesn't
  const member = (type, status) => ({ chat: { id: -100, type }, from: { id: 9 }, myChatMember: { new_chat_member: { status } } })
  await handleMyChatMember(member('supergroup', 'left'))
  await handleMyChatMember(member('group', 'kicked'))
  await handleMyChatMember(member('supergroup', 'member'))
  await handleMyChatMember(member('private', 'kicked'))
  assert.deepEqual(removed, [-100, -100])
}

async function main() {
  await provesTheHook()
  await provesTheButtonOnGroupTranscriptions()
  await provesThePromosCommandAndRemovals()
  console.log('promo group proof passed')
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
