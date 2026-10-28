import { Api } from 'grammy'
import { BroadcastModel, BroadcastRecipientModel } from '@/models/Broadcast'
import { ChatModel } from '@/models/Chat'
import {
  TelegramReachabilityFailureKind,
  classifyTelegramReachabilityFailure,
  markChatUnreachableByIdForTelegramError,
} from '@/helpers/chatReachability'
import { TranscriptionJobModel } from '@/models/TranscriptionJob'
import { Types } from 'mongoose'
import { VoiceModel } from '@/models/Voice'
import { createHash } from 'crypto'
import Context from '@/models/Context'
import axios from 'axios'

// Broadcasts: one message from Voicy to a sample of its lapsed private chats,
// with a holdout that gets nothing. Each one is an experiment Nikita approved
// in Prime Radiant, defined in its go/campaigns.json ("broadcasts"), which this
// re-reads every 5 minutes. Status there: draft (nothing), dry-run (count and
// draw, send nothing), running, paused, stopped. Radiant's launcher starts one
// by setting it to running; nothing here sends without that.
// - Draw: chats ranked by sha256("<id>:<chat id>"); the first `size` get it,
//   the next `holdout` never do. Both lists are saved before the first send.
// - One message per chat: a unique (broadcast, chat) record, claimed before
//   the send. A claim a crash interrupted is never resent.
// - Telegram limits: `rate` a second at most; 429s wait retry_after
//   (auto-retry), and a 429 that still fails stops the broadcast.
// - Blocked, deleted and missing chats are marked unreachable, never retried
//   and kept out of the harm numbers: they were gone before we wrote.
// - Harm: new blocks (my_chat_member -> kicked) within 48 h of delivery, or of
//   the start for the holdout, plus opt-outs. Checked every `check_every`
//   deliveries; past a threshold the broadcast stops for good.
// Reports (never Telegram ids, only the salted hash promoStart.ts uses):
// events drawn/sent/unreachable/failed/blocked/optout and the state, to
// Radiant's go service (bin/xp.py broadcast <id> reads them).

const DAY = 86_400_000
const WATCH = 48 * 3600_000

export type BroadcastConfig = {
  id: string
  bot: string
  status: string
  target: string
  payload: string
  audience: { chats: string; langs: string[]; active_days: [number, number] }
  size: number
  holdout: number
  rate: number
  check_every: number
  stop: { blocks_over_holdout: number; blocks: number; optouts: number }
  text: Record<string, string>
  button: Record<string, string>
  optout: Record<string, string>
  optout_done: Record<string, string>
}

export type Counts = {
  eligible?: number
  treatment: number
  holdout: number
  sent: number
  unreachable: number
  failed: number
  blocked_t: number
  blocked_h: number
  optout: number
}

const configUrl = () =>
  process.env.PROMO_URL || 'https://lumen.borodutch.com/go/campaigns.json'
// reports go next to the config, never to a host the config names
const reportUrl = (path: string) =>
  configUrl().replace(/campaigns\.json$/, path)

const sha = (s: string) => createHash('sha256').update(s).digest('hex')
export const rank = (id: string, chatId: string) => sha(`${id}:${chatId}`)
export const unitOf = (token: string, id: string, chatId: string) =>
  sha(`${token}:${id}:${chatId}`).slice(0, 16)

// The sample: the lowest ranks get the message, the next ones are the holdout
export function draw(
  id: string,
  chats: { chatId: string; lang: string }[],
  size: number,
  holdout: number
) {
  const ranked = chats
    .map((c) => ({ ...c, rank: rank(id, c.chatId) }))
    .sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0))
  return {
    treatment: ranked.slice(0, size),
    holdout: ranked.slice(size, size + holdout),
  }
}

export function byLang(
  rows: { lang: string; arm?: string }[],
  langs: string[]
) {
  const out: Record<string, { treatment: number; holdout: number }> = {}
  for (const l of langs) out[l] = { treatment: 0, holdout: 0 }
  for (const r of rows) {
    const t = out[r.lang] || (out[r.lang] = { treatment: 0, holdout: 0 })
    if (r.arm === 'holdout') t.holdout++
    else t.treatment++
  }
  return out
}

// The message in a chat's language, exactly as the config has it
export function message(cfg: BroadcastConfig, lang: string) {
  const l = cfg.text[lang] ? lang : 'en'
  return {
    text: cfg.text[l],
    other: {
      parse_mode: 'HTML' as const,
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [{ text: cfg.button[l], url: `${cfg.target}?start=${cfg.payload}` }],
          [{ text: cfg.optout[l], callback_data: `bco:${cfg.id}` }],
        ],
      },
    },
  }
}

// Why the broadcast has to stop, or undefined. Unreachable chats are not in
// the denominators: only delivered messages (and the drawn holdout) count.
export function breach(cfg: BroadcastConfig, n: Counts) {
  if (!n.sent) return undefined
  const blocks = n.blocked_t / n.sent
  const holdout = n.holdout ? n.blocked_h / n.holdout : 0
  const optouts = n.optout / n.sent
  const pct = (x: number) => `${(100 * x).toFixed(1)}%`
  if (blocks - holdout >= cfg.stop.blocks_over_holdout)
    return `new blocks ${pct(blocks)} against the holdout's ${pct(holdout)}`
  if (blocks >= cfg.stop.blocks)
    return `new blocks ${pct(blocks)} (limit ${pct(cfg.stop.blocks)})`
  if (optouts >= cfg.stop.optouts)
    return `opt-outs ${pct(optouts)} (limit ${pct(cfg.stop.optouts)})`
  return undefined
}

const is429 = (error: unknown) =>
  (error as { error_code?: number })?.error_code === 429

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function post(path: string, body: unknown) {
  const token = process.env.PROMO_TOKEN
  if (!token) return
  await axios
    .post(reportUrl(path), body, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30_000,
    })
    .catch((error) => console.error(`broadcast ${path}`, error?.message))
}

// Events wait in a queue and go out in batches (at every status and every 250)
let queue: unknown[] = []

async function flush() {
  while (queue.length) {
    const batch = queue.slice(0, 1000)
    queue = queue.slice(1000)
    await post('events', { events: batch })
  }
}

async function report(
  id: string,
  rows: { chatId: string; arm: string }[],
  kind: string
) {
  const token = process.env.PROMO_TOKEN
  if (!token || !rows.length) return
  const t = Math.floor(Date.now() / 1000)
  for (const r of rows)
    queue.push({
      c: id,
      v: r.arm === 'holdout' ? 'holdout' : 'a',
      k: kind,
      u: unitOf(token, id, r.chatId),
      b: 'voicy',
      t,
    })
  if (queue.length >= 250) await flush()
}

async function status(
  id: string,
  state: string,
  extra: {
    reason?: string
    counts?: Partial<Counts>
    by_lang?: unknown
  } = {}
) {
  await flush()
  const doc = await BroadcastModel.findOneAndUpdate(
    { id },
    { lastStatusAt: new Date() },
    { upsert: true, new: true }
  )
  await post('status', {
    id,
    bot: 'voicy',
    state,
    reason: extra.reason ?? doc.reason,
    counts: extra.counts,
    by_lang: extra.by_lang,
    started: doc.startedAt,
    done: doc.doneAt,
    updated: new Date().toISOString(),
  })
}

// Private chats whose last activity (the audience catalog's: a transcription
// job, a voice record, a new chat, a /start after a block or from a campaign)
// falls in the config's window, still reachable, not opted out or banned, in
// one of its languages, and not sent a broadcast in the last 90 days.
async function eligible(cfg: BroadcastConfig, now = Date.now()) {
  const [from, to] = cfg.audience.active_days
  const since = new Date(now - to * DAY)
  const until = new Date(now - from * DAY)
  const oid = Types.ObjectId.createFromTime(Math.floor(since.getTime() / 1000))
  const created = { $toDate: '$_id' }
  const rows: { _id: string; l: string }[] =
    await TranscriptionJobModel.aggregate([
      { $match: { _id: { $gte: oid } } },
      { $project: { k: '$chatId', t: created } },
      {
        $unionWith: {
          coll: VoiceModel.collection.name,
          pipeline: [
            { $match: { _id: { $gte: oid } } },
            { $project: { k: '$chatId', t: created } },
          ],
        },
      },
      {
        $unionWith: {
          coll: ChatModel.collection.name,
          pipeline: [
            {
              $match: {
                $or: [
                  { _id: { $gte: oid } },
                  { transcriptionReachableAt: { $gte: since } },
                  { promoStartAt: { $gte: since } },
                ],
              },
            },
            {
              $project: {
                k: '$id',
                t: {
                  $max: [created, '$transcriptionReachableAt', '$promoStartAt'],
                },
              },
            },
          ],
        },
      },
      // private chats only: users have positive ids
      { $match: { k: { $regex: /^[0-9]+$/ } } },
      { $group: { _id: '$k', last: { $max: '$t' } } },
      { $match: { last: { $lt: until } } },
      {
        $lookup: {
          from: ChatModel.collection.name,
          localField: '_id',
          foreignField: 'id',
          as: 'c',
        },
      },
      { $unwind: '$c' },
      {
        $match: {
          'c.botCanSendMessages': { $ne: false },
          'c.noNews': { $ne: true },
          'c.banned': { $ne: true },
          'c.uiLanguage': { $in: cfg.audience.langs },
        },
      },
      { $project: { _id: 1, l: '$c.uiLanguage' } },
    ])
      .allowDiskUse(true)
      .option({ maxTimeMS: 20 * 60_000 })
  const recent = new Set(
    (
      await BroadcastRecipientModel.find(
        {
          broadcast: { $ne: cfg.id },
          sentAt: { $gte: new Date(now - 90 * DAY) },
        },
        { chatId: 1 }
      ).lean()
    ).map((r) => r.chatId)
  )
  return rows
    .filter((r) => !recent.has(r._id))
    .map((r) => ({ chatId: r._id, lang: r.l }))
}

async function tally(cfg: BroadcastConfig): Promise<Counts> {
  const rows = await BroadcastRecipientModel.find(
    { broadcast: cfg.id },
    { arm: 1, state: 1, blockedAt: 1, optOutAt: 1, lang: 1 }
  ).lean()
  const n: Counts = {
    treatment: 0,
    holdout: 0,
    sent: 0,
    unreachable: 0,
    failed: 0,
    blocked_t: 0,
    blocked_h: 0,
    optout: 0,
  }
  for (const r of rows) {
    if (r.arm === 'holdout') {
      n.holdout++
      if (r.blockedAt) n.blocked_h++
      continue
    }
    n.treatment++
    if (r.state === 'sent') n.sent++
    if (r.state === 'unreachable') n.unreachable++
    if (r.state === 'failed') n.failed++
    if (r.blockedAt) n.blocked_t++
    if (r.optOutAt) n.optout++
  }
  return n
}

async function langCounts(cfg: BroadcastConfig) {
  const rows = await BroadcastRecipientModel.find(
    { broadcast: cfg.id },
    { arm: 1, lang: 1, state: 1 }
  ).lean()
  const out = byLang(rows, cfg.audience.langs) as Record<
    string,
    { treatment: number; holdout: number; sent?: number }
  >
  for (const r of rows)
    if (r.state === 'sent') out[r.lang].sent = (out[r.lang].sent || 0) + 1
  return out
}

let latest: BroadcastConfig[] = []
let halted = true
let running: Promise<void> | undefined

export const broadcastConfig = (id: string) => latest.find((b) => b.id === id)

async function refresh() {
  try {
    const { data } = await axios.get(configUrl(), { timeout: 10_000 })
    latest = ((data?.broadcasts || []) as BroadcastConfig[]).filter(
      (b) => b.bot === 'voicy'
    )
  } catch (error) {
    console.error('broadcast config', (error as Error)?.message)
  }
}

async function stop(cfg: BroadcastConfig, reason: string) {
  await BroadcastModel.updateOne({ id: cfg.id }, { state: 'stopped', reason })
  console.warn(`broadcast ${cfg.id} stopped: ${reason}`)
  await status(cfg.id, 'stopped', {
    reason,
    counts: await tally(cfg),
    by_lang: await langCounts(cfg),
  })
}

async function dryRun(cfg: BroadcastConfig) {
  const doc = await BroadcastModel.findOne({ id: cfg.id })
  if (doc?.dryRunAt && Date.now() - doc.dryRunAt.getTime() < 6 * 3600_000)
    return
  const chats = await eligible(cfg)
  const d = draw(cfg.id, chats, cfg.size, cfg.holdout)
  const langs = byLang(
    [
      ...d.treatment.map((c) => ({ lang: c.lang })),
      ...d.holdout.map((c) => ({ lang: c.lang, arm: 'holdout' })),
    ],
    cfg.audience.langs
  ) as Record<string, { treatment: number; holdout: number; eligible?: number }>
  for (const c of chats)
    if (langs[c.lang])
      langs[c.lang].eligible = (langs[c.lang].eligible || 0) + 1
  await BroadcastModel.updateOne(
    { id: cfg.id },
    { dryRunAt: new Date() },
    { upsert: true }
  )
  console.info(
    `broadcast ${cfg.id} dry run: ${chats.length} eligible, ${d.treatment.length} + ${d.holdout.length} holdout`
  )
  await status(cfg.id, 'dry-run', {
    reason: 'dry run: nothing sent',
    counts: {
      eligible: chats.length,
      treatment: d.treatment.length,
      holdout: d.holdout.length,
    },
    by_lang: langs,
  })
}

async function send(api: Api, cfg: BroadcastConfig) {
  let doc = await BroadcastModel.findOne({ id: cfg.id })
  if (doc?.state === 'stopped' || doc?.state === 'done') return
  if (!doc?.drawnAt) {
    const d = draw(cfg.id, await eligible(cfg), cfg.size, cfg.holdout)
    const rows = [
      ...d.treatment.map((c) => ({ ...c, arm: 'a' })),
      ...d.holdout.map((c) => ({ ...c, arm: 'holdout' })),
    ].map((c) => ({ ...c, broadcast: cfg.id }))
    await BroadcastRecipientModel.insertMany(rows, { ordered: false }).catch(
      (error) => {
        if (error?.code !== 11000) throw error // already drawn: kept as it was
      }
    )
    doc = await BroadcastModel.findOneAndUpdate(
      { id: cfg.id },
      { drawnAt: new Date(), state: 'drawn' },
      { upsert: true, new: true }
    )
    await report(cfg.id, rows, 'drawn')
  }
  const admin = process.env.ADMIN_ID
  if (admin && !doc.previewSentAt) {
    for (const l of cfg.audience.langs) {
      const m = message(cfg, l)
      await api
        .sendMessage(admin, m.text, m.other)
        .catch((error) => console.error('broadcast preview', error?.message))
    }
    doc.previewSentAt = new Date()
  }
  if (!doc.startedAt) doc.startedAt = new Date()
  doc.state = 'sending'
  await doc.save()
  // a claim a crash or a deploy interrupted may have gone out: never again
  await BroadcastRecipientModel.updateMany(
    { broadcast: cfg.id, state: 'sending' },
    { state: 'failed', error: 'interrupted' }
  )
  await status(cfg.id, 'sending', {
    counts: await tally(cfg),
    by_lang: await langCounts(cfg),
  })
  let delivered = 0
  while (!halted && broadcastConfig(cfg.id)?.status === 'running') {
    const r = await BroadcastRecipientModel.findOneAndUpdate(
      { broadcast: cfg.id, arm: 'a', state: 'drawn' },
      { state: 'sending' },
      { sort: { rank: 1 }, new: true }
    )
    if (!r) {
      await BroadcastModel.updateOne(
        { id: cfg.id },
        { state: 'done', doneAt: new Date() }
      )
      return status(cfg.id, 'done', {
        counts: await tally(cfg),
        by_lang: await langCounts(cfg),
      })
    }
    const began = Date.now()
    const m = message(cfg, r.lang)
    try {
      await api.sendMessage(r.chatId, m.text, m.other)
      r.state = 'sent'
      r.sentAt = new Date()
    } catch (error) {
      if (is429(error)) {
        r.state = 'drawn'
        await r.save()
        return stop(cfg, "Telegram's 429 didn't clear after retry_after")
      }
      const failure = classifyTelegramReachabilityFailure(error)
      r.error = failure.description.slice(0, 200)
      if (failure.kind === TelegramReachabilityFailureKind.permanent) {
        r.state = 'unreachable'
        await markChatUnreachableByIdForTelegramError(r.chatId, error, {
          location: `broadcast.${cfg.id}`,
        }).catch((e) => console.error('broadcast unreachable', e?.message))
      } else r.state = 'failed'
    }
    await r.save()
    await report(cfg.id, [r], r.state)
    if (r.state === 'sent' && ++delivered % cfg.check_every === 0) {
      const n = await tally(cfg)
      const why = breach(cfg, n)
      if (why) return stop(cfg, why)
      await status(cfg.id, 'sending', {
        counts: n,
        by_lang: await langCounts(cfg),
      })
    }
    await sleep(
      Math.max(0, 1000 / Math.min(cfg.rate, 25) - (Date.now() - began))
    )
  }
  // paused or stopped in the config (or this container hands polling over)
  const cfgNow = broadcastConfig(cfg.id)
  if (!halted && cfgNow?.status === 'stopped')
    return stop(cfg, 'stopped in the config')
  if (!halted)
    await status(cfg.id, 'paused', {
      reason: `config status ${cfgNow?.status || 'missing'}`,
      counts: await tally(cfg),
    })
}

// After the start: the harm numbers every hour for 48 h after the last send,
// and a stop (or, once everything went out, a reason) when one passes its limit
async function watch(cfg: BroadcastConfig) {
  const doc = await BroadcastModel.findOne({ id: cfg.id })
  if (!doc?.startedAt) return
  const end = (doc.doneAt || new Date()).getTime() + WATCH
  if (Date.now() > end + 3600_000) return
  if (doc.lastStatusAt && Date.now() - doc.lastStatusAt.getTime() < 3600_000)
    return
  const n = await tally(cfg)
  const why = breach(cfg, n)
  if (why && doc.state !== 'stopped') {
    if (doc.state === 'done') {
      await BroadcastModel.updateOne({ id: cfg.id }, { reason: why })
    } else return stop(cfg, why)
  }
  await status(cfg.id, doc.state || 'sending', {
    reason: why,
    counts: n,
    by_lang: await langCounts(cfg),
  })
}

async function tick(api: Api) {
  for (const cfg of latest) {
    try {
      if (cfg.status === 'dry-run') await dryRun(cfg)
      else if (cfg.status === 'running') await send(api, cfg)
      else if (cfg.status === 'stopped') {
        const doc = await BroadcastModel.findOne({ id: cfg.id })
        if (doc?.state === 'sending' || doc?.state === 'drawn')
          await stop(cfg, 'stopped in the config')
      }
      if (cfg.status !== 'dry-run' && cfg.status !== 'draft') await watch(cfg)
    } catch (error) {
      console.error(`broadcast ${cfg.id}`, (error as Error)?.message)
    }
  }
}

// Runs only in the container that holds polling, so a deploy never has two
// senders; stopBroadcasts waits for the message in flight
export function startBroadcasts(api: Api) {
  halted = false
  // the config is re-read on its own timer, so a send in progress sees a pause or a stop within 5 minutes
  const timer = setInterval(() => void refresh(), 5 * 60_000)
  const loop = async () => {
    await refresh()
    while (!halted) {
      await tick(api)
      for (let i = 0; i < 300 && !halted; i++) await sleep(1000)
    }
    clearInterval(timer)
    await flush()
  }
  running = loop().catch((error) => console.error('broadcasts', error?.message))
}

export async function stopBroadcasts() {
  halted = true
  await running
}

// A block in a private chat within 48 h of our message (or of the start, for
// the holdout) counts against the broadcast
export async function recordBroadcastBlock(ctx: Context) {
  const m = ctx.myChatMember
  if (!m || m.chat.type !== 'private' || m.new_chat_member.status !== 'kicked')
    return
  const chatId = String(m.chat.id)
  const now = Date.now()
  for (const r of await BroadcastRecipientModel.find({
    chatId,
    blockedAt: { $exists: false },
  })) {
    const doc = await BroadcastModel.findOne({ id: r.broadcast })
    const from = r.arm === 'holdout' ? doc?.startedAt : r.sentAt
    if (!from || now < from.getTime() || now - from.getTime() > WATCH) continue
    r.blockedAt = new Date()
    await r.save()
    await report(r.broadcast, [r], 'blocked')
  }
  await flush()
}

// "Don't send me news": no broadcast reaches this chat again
export async function handleBroadcastOptOut(ctx: Context) {
  const id = (ctx.callbackQuery?.data || '').slice(4)
  const chatId = String(ctx.chat?.id || ctx.from?.id)
  await ChatModel.updateOne({ id: chatId }, { noNews: true })
  const r = await BroadcastRecipientModel.findOneAndUpdate(
    { broadcast: id, chatId, optOutAt: { $exists: false } },
    { optOutAt: new Date() }
  )
  if (r) {
    await report(id, [r], 'optout')
    await flush()
  }
  if (!broadcastConfig(id)) await refresh()
  const cfg = broadcastConfig(id)
  const lang = r?.lang || ctx.dbchat?.uiLanguage || 'en'
  await ctx.answerCallbackQuery().catch(() => undefined)
  await ctx.reply(
    cfg?.optout_done[lang] || cfg?.optout_done.en || 'OK, no more news.'
  )
}
