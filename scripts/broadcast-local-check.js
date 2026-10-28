// Local end-to-end check (not in CI): node scripts/broadcast-local-check.js with MONGO pointing at a scratch mongod
require('module-alias/register')
require('reflect-metadata')
const assert = require('assert')
const http = require('http')
const mongoose = require('mongoose')

const DAY = 864e5
const status = []
const events = []
let cfg
const server = http.createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    if (req.url === '/go/campaigns.json') return res.end(JSON.stringify({ broadcasts: [cfg] }))
    assert.equal(req.headers.authorization, 'Bearer tok')
    if (req.url === '/go/status') status.push(JSON.parse(body))
    if (req.url === '/go/events') events.push(...JSON.parse(body).events)
    res.end('{}')
  })
})

async function main() {
  await new Promise((r) => server.listen(0, r))
  process.env.PROMO_URL = `http://127.0.0.1:${server.address().port}/go/campaigns.json`
  process.env.PROMO_TOKEN = 'tok'
  process.env.ADMIN_ID = '76'
  await mongoose.connect(process.env.MONGO)
  await mongoose.connection.db.dropDatabase()
  const { ChatModel } = require('../dist/models/Chat')
  const { TranscriptionJobModel } = require('../dist/models/TranscriptionJob')
  const { BroadcastRecipientModel, BroadcastModel } = require('../dist/models/Broadcast')
  const b = require('../dist/helpers/broadcast')
  const oid = (daysAgo) => new mongoose.Types.ObjectId(Math.floor((Date.now() - daysAgo * DAY) / 1000).toString(16).padStart(8, '0') + require('crypto').randomBytes(8).toString('hex'))
  const chats = mongoose.connection.db.collection('chats')
  const jobs = mongoose.connection.db.collection('transcriptionjobs')
  // 1001-1010 lapsed en/ru, 1011 current user, 1012 too old, 1013 unreachable, 1014 de, 1015 opted out, -5 group
  const mk = (id, ago, extra = {}) => chats.insertOne({ _id: oid(400), id, uiLanguage: 'en', botCanSendMessages: true, ...extra }).then(() => jobs.insertOne({ _id: oid(ago), chatId: id }))
  for (let i = 1; i <= 10; i++) await mk(String(1000 + i), 60, { uiLanguage: i % 2 ? 'en' : 'ru' })
  await mk('1011', 60)
  await jobs.insertOne({ _id: oid(3), chatId: '1011' })
  await mk('1012', 300)
  await mk('1013', 60, { botCanSendMessages: false })
  await mk('1014', 60, { uiLanguage: 'de' })
  await mk('1015', 60, { noNews: true })
  await mk('-5', 60)
  cfg = {
    id: 'bc1', bot: 'voicy', status: 'dry-run', target: 'https://t.me/videodownloadbot', payload: 'bc1-a-voicy',
    audience: { chats: 'private', langs: ['en', 'ru'], active_days: [30, 180] }, size: 6, holdout: 3, rate: 25, check_every: 2,
    stop: { blocks_over_holdout: 0.5, blocks: 0.9, optouts: 0.9 },
    text: { en: 'Hi', ru: 'Привет' }, button: { en: 'Open', ru: 'Открыть' }, optout: { en: 'No', ru: 'Нет' }, optout_done: { en: 'Done', ru: 'Готово' },
  }
  const sent = []
  const api = {
    sendMessage: async (chatId, text, other) => {
      if (chatId === '76') return sent.push(['preview', text])
      const blockedId = (await BroadcastRecipientModel.find({ arm: 'a' }).sort({ rank: 1 }).lean())[1].chatId
      if (chatId === blockedId) throw Object.assign(new Error('x'), { error_code: 403, description: 'Forbidden: bot was blocked by the user' })
      sent.push([chatId, text, other.reply_markup.inline_keyboard[0][0].url])
    },
  }
  const wait = async (f) => { for (let i = 0; i < 200 && !f(); i++) await new Promise((r) => setTimeout(r, 50)) ; assert.ok(f()) }

  b.startBroadcasts(api)
  await wait(() => status.some((s) => s.state === 'dry-run'))
  await b.stopBroadcasts()
  const dry = status.find((s) => s.state === 'dry-run')
  assert.deepStrictEqual([dry.counts.eligible, dry.counts.treatment, dry.counts.holdout], [10, 6, 3])
  assert.equal(dry.by_lang.en.eligible + dry.by_lang.ru.eligible, 10)
  assert.equal(sent.length, 0)
  assert.equal(await BroadcastRecipientModel.countDocuments(), 0)

  cfg.status = 'running'
  b.startBroadcasts(api)
  await wait(() => status.some((s) => s.state === 'done'))
  await b.stopBroadcasts()
  assert.equal(sent.filter((s) => s[0] === 'preview').length, 2)
  const real = sent.filter((s) => s[0] !== 'preview')
  assert.equal(real.length, 5)
  assert.equal(new Set(real.map((s) => s[0])).size, 5)
  assert.ok(real.every((s) => s[2] === 'https://t.me/videodownloadbot?start=bc1-a-voicy'))
  const done = status.find((s) => s.state === 'done')
  assert.deepStrictEqual([done.counts.sent, done.counts.unreachable, done.counts.holdout], [5, 1, 3])
  const dead = (await BroadcastRecipientModel.findOne({ state: 'unreachable' })).chatId
  assert.equal((await ChatModel.findOne({ id: dead })).botCanSendMessages, false)
  assert.equal(events.filter((e) => e.k === 'drawn').length, 9)
  assert.equal(events.filter((e) => e.k === 'sent').length, 5)

  // a restart sends nothing again
  sent.length = 0
  b.startBroadcasts(api)
  await new Promise((r) => setTimeout(r, 1000))
  await b.stopBroadcasts()
  assert.equal(sent.length, 0)

  // a block within 48 h counts; opt-out sets the flag
  const target = await BroadcastRecipientModel.findOne({ state: 'sent' })
  await b.recordBroadcastBlock({ myChatMember: { chat: { id: Number(target.chatId), type: 'private' }, new_chat_member: { status: 'kicked' } } })
  assert.ok((await BroadcastRecipientModel.findById(target._id)).blockedAt)
  const other = await BroadcastRecipientModel.findOne({ state: 'sent', blockedAt: { $exists: false } })
  const replies = []
  await b.handleBroadcastOptOut({ callbackQuery: { data: 'bco:bc1' }, chat: { id: Number(other.chatId) }, answerCallbackQuery: async () => undefined, reply: async (t) => replies.push(t) })
  assert.equal((await ChatModel.findOne({ id: other.chatId })).noNews, true)
  assert.ok(['Done', 'Готово'].includes(replies[0]))
  assert.ok(events.some((e) => e.k === 'blocked') && events.some((e) => e.k === 'optout'))

  // sticky stop: a second broadcast that breaches stops and never resumes
  await mongoose.connection.db.dropDatabase()
  for (let i = 1; i <= 10; i++) await mk(String(2000 + i), 60)
  cfg = { ...cfg, id: 'bc2', payload: 'bc2-a-voicy', size: 8, holdout: 2, check_every: 2, stop: { blocks_over_holdout: 0.01, blocks: 0.015, optouts: 0.9 } }
  let n = 0
  const api2 = { sendMessage: async (chatId) => { if (chatId === '76') return; n++; if (n === 1) await b.recordBroadcastBlock({ myChatMember: { chat: { id: Number(chatId), type: 'private' }, new_chat_member: { status: 'kicked' } } }) } }
  // the block must land after sentAt is saved: block the first chat right after it is marked sent
  const orig = api2.sendMessage
  api2.sendMessage = async (chatId, ...rest) => { await orig(chatId, ...rest); if (n === 2) { const first = await BroadcastRecipientModel.findOne({ state: 'sent' }); await b.recordBroadcastBlock({ myChatMember: { chat: { id: Number(first.chatId), type: 'private' }, new_chat_member: { status: 'kicked' } } }) } }
  status.length = 0
  b.startBroadcasts(api2)
  await wait(() => status.some((s) => s.state === 'stopped'))
  await b.stopBroadcasts()
  const stopped = status.find((s) => s.state === 'stopped')
  assert.match(stopped.reason, /new blocks/)
  assert.ok(stopped.counts.sent < 8, stopped.counts)
  const before = n
  b.startBroadcasts(api2)
  await new Promise((r) => setTimeout(r, 1000))
  await b.stopBroadcasts()
  assert.equal(n, before)
  assert.equal((await BroadcastModel.findOne({ id: 'bc2' })).state, 'stopped')
  console.log('broadcast local check passed')
  await mongoose.disconnect()
  server.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
