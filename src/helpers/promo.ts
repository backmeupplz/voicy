/* eslint-disable @typescript-eslint/no-non-null-assertion -- the canonical copy (prime-radiant go/promo.ts) asserts after its own checks */
// Prime Radiant's reply-promo hook for Nikita's Telegram bots: the shared copy.
// Canonical file: backmeupplz/prime-radiant go/promo.ts. Each bot carries a
// copy; this one uses axios instead of fetch (@types/node 16 has no fetch).
// Change the canonical file first, then the bots. Rules: projects/telegram-bots/cross-promo.md.
//
// Campaigns live in go/campaigns.json, served at PROMO_URL; the bot re-reads it
// every 5 minutes. Each user lands in a fixed arm per campaign (a hash of
// campaign and user id): a variant, or the holdout that never sees a promo. A
// variant shows its line at most once per cap_days, only in the chat types the
// campaign names (private by default), only in a language it has text for, at
// most one promo per reply. The bot reports, with a salted user hash (never the
// Telegram id): seen (an eligible reply, once a day, holdout too), shown,
// blocked (the user blocked the bot), and for people other bots' campaigns
// bring here: start, new (the chat is new) and use (the bot's main action in
// the 7 days after, once a day).
//
// Off when: PROMO=off, no PROMO_TOKEN, the config says so
// (bots.<bot>.enabled, a campaign's status), or the config couldn't be read for
// an hour. The salt comes from GET /go/salt with PROMO_TOKEN, so it is the same
// in every bot and a /start in one bot joins up with a promo shown in another.

import { createHash } from 'crypto'
import axios from 'axios'

const STALE = 3600_000
const DAY = 86400_000
const WEEK = 7 * DAY

export type Variant = {
  id: string
  share: number
  format: 'caption' | 'button'
  text?: Record<string, string>
  target?: string
}
export type Campaign = {
  id: string
  bot: string
  status: string
  target: string
  chats: string[]
  cap_days: number
  langs: string[]
  text: Record<string, string>
  variants: Variant[]
}
export type Config = {
  base: string
  bots: Record<string, { enabled: boolean; code: string }>
  campaigns: Campaign[]
}
export type Promo = { text: string; url: string; format: Variant['format'] }
export type Decision = {
  campaign: string
  arm: string
  unit: string
  promo?: Promo
}
type Kind = 'seen' | 'shown' | 'start' | 'new' | 'use' | 'blocked'
type Event = { c: string; v: string; k: Kind; u: string; t: number; b: string }
// A tiny key-value store in the bot's own database (Mongo, Postgres, SQLite)
export type Store = {
  get(key: string): Promise<string | undefined>
  set(key: string, value: string): Promise<void>
}

// /start payload from a campaign link: <campaign>-<variant>-<source bot code>
export const ARRIVAL = /^([a-z0-9]{1,16})-([a-z0-9]{1,8})-([a-z0-9]{1,12})$/
const BOT_LINK = /^https:\/\/t\.me\/[A-Za-z0-9_]{2,29}bot$/i

const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const day = (t = Date.now()) => new Date(t).toISOString().slice(0, 10)
const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// Where a user falls in [0, 1) for a campaign: the same every time, in every bot
export const bucket = (campaign: string, user: number) =>
  parseInt(sha(`${campaign}:${user}`).slice(0, 8), 16) / 2 ** 32

// The user's arm: variants take their shares from 0 up, the rest is holdout
export function arm(c: Campaign, user: number) {
  const b = bucket(c.id, user)
  let edge = 0
  for (const v of c.variants) if (b < (edge += v.share)) return v
  return undefined
}

export const unitOf = (salt: string, campaign: string, user: number) =>
  sha(`${salt}:${campaign}:${user}`).slice(0, 16)

// The link a promo carries: a bot gets a native deep link (Telegram opens it in
// the app; the promoted bot reports the /start), a channel invite link goes as
// it is (joins are counted per link), a web page goes through the /go redirect
// (counts the tap, adds UTM or store campaign tags)
export function link(
  cfg: Config,
  bot: string,
  c: Campaign,
  v: Variant,
  unit: string
) {
  const target = v.target ?? c.target
  if (BOT_LINK.test(target)) {
    const payload = `${c.id}-${v.id}-${cfg.bots[bot]?.code}`
    return ARRIVAL.test(payload) ? `${target}?start=${payload}` : undefined
  }
  if (/^https:\/\/t\.me\//.test(target)) return target
  return `${cfg.base}/${c.id}/${v.id}?u=${unit}`
}

const usable = (cfg: Config, bot: string, c: Campaign) =>
  c.bot === bot &&
  c.status === 'running' &&
  c.variants.reduce((s, v) => s + v.share, 0) < 1 &&
  c.variants.every(
    (v) => v.share > 0 && link(cfg, bot, c, v, '0') !== undefined
  )

export const baseLang = (code: string | undefined) =>
  (code || 'en').toLowerCase().split(/[-_]/)[0]!

// What to do for one reply: null = not in any experiment (log nothing)
export function decide(
  cfg: Config | undefined,
  bot: string,
  salt: string,
  user: number,
  chat: string,
  code: string | undefined,
  lastShown:
    | number
    | undefined
    | ((campaign: string, unit: string) => number | undefined),
  now = Date.now()
): Decision | null {
  if (!cfg || !salt || cfg.bots?.[bot]?.enabled !== true) return null
  const l = baseLang(code)
  const c = cfg.campaigns.find(
    (c) =>
      usable(cfg, bot, c) &&
      c.chats.includes(chat) &&
      c.langs.includes(l) &&
      c.text[l]
  )
  if (!c) return null
  const unit = unitOf(salt, c.id, user)
  const v = arm(c, user)
  if (!v) return { campaign: c.id, arm: 'holdout', unit }
  const last =
    typeof lastShown === 'function' ? lastShown(c.id, unit) : lastShown
  const capped = last !== undefined && now - last < c.cap_days * DAY
  return {
    campaign: c.id,
    arm: v.id,
    unit,
    promo: capped
      ? undefined
      : {
          text: v.text?.[l] ?? c.text[l]!,
          url: link(cfg, bot, c, v, unit)!,
          format: v.format,
        },
  }
}

// The promo as the end of an HTML message (a caption line), else ''
export const html = (p?: Promo) =>
  p?.format === 'caption'
    ? `\n\n<a href="${esc(p.url)}">${esc(p.text)}</a>`
    : ''
// The same for legacy Markdown messages (promo texts carry no [ ] ( ) * _ `)
export const markdown = (p?: Promo) =>
  p?.format === 'caption'
    ? `\n\n[${p.text.replace(/[[\]()*_`]/g, '')}](${p.url})`
    : ''
// reply_markup with the promo's button added as the last row (button variants)
export function keyboard<T extends { inline_keyboard?: unknown[][] }>(
  p?: Promo,
  markup?: T
) {
  if (p?.format !== 'button') return markup
  const rows = [
    ...(markup?.inline_keyboard ?? []),
    [{ text: p.text, url: p.url }],
  ]
  return { ...(markup ?? {}), inline_keyboard: rows } as T & {
    inline_keyboard: unknown[][]
  }
}

export function promos(
  bot: string,
  store: Store,
  env: Record<string, string | undefined> = process.env
) {
  const off = env.PROMO === 'off'
  const token = env.PROMO_TOKEN || ''
  const url = env.PROMO_URL || 'https://lumen.borodutch.com/go/campaigns.json'
  // events and the salt come from next to the config, never from a host the
  // config names: the token goes with them
  const events = url.replace(/campaigns\.json$/, 'events')
  const saltUrl = url.replace(/campaigns\.json$/, `salt?bot=${bot}`)
  let cfg: Config | undefined
  let fetched = 0
  let salt = ''
  let queue: Event[] = []
  const timers: ReturnType<typeof setInterval>[] = []

  async function refresh() {
    if (off || !token) return
    try {
      if (!salt) {
        const res = await axios.get<{ salt?: string }>(saltUrl, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10_000,
        })
        salt = res.data.salt || ''
      }
      cfg = (await axios.get<Config>(url, { timeout: 10_000 })).data
      fetched = Date.now()
    } catch (e) {
      console.error('promo config', (e as Error).message)
    }
  }

  async function flush() {
    if (!queue.length || !token) return
    const batch = queue
    queue = []
    try {
      await axios.post(
        events,
        { events: batch },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 10_000 }
      )
    } catch (e) {
      console.error('promo events', (e as Error).message)
      queue = [...batch, ...queue].slice(-20_000)
    }
  }

  const push = (e: Omit<Event, 't' | 'b'>) => {
    queue.push({ ...e, t: Math.floor(Date.now() / 1000), b: bot })
    if (queue.length >= 500) void flush()
  }
  const fresh = () => (Date.now() - fetched < STALE ? cfg : undefined)
  const safe = async <T>(what: string, f: () => Promise<T>) => {
    try {
      return await f()
    } catch (e) {
      console.error(`promo ${what}`, (e as Error).message)
      return undefined
    }
  }

  return {
    refresh,
    flush,
    // the campaigns as last read (undefined when stale), for Voicy's invite links
    config: fresh,
    // refresh now, then every 5 minutes; send events every minute
    start() {
      void refresh()
      timers.push(setInterval(refresh, 5 * 60_000), setInterval(flush, 60_000))
      for (const t of timers) (t as { unref?: () => void }).unref?.()
    },
    // on shutdown (the handover's drain): stop timers, send what's queued
    async stop() {
      timers.splice(0).forEach(clearInterval)
      await flush()
    },
    // The promo for a private reply about to go out, or null. It counts
    // against the cap as soon as it's handed out. Never throws.
    async decide(
      user: number | undefined,
      chat: string | undefined,
      code: string | undefined
    ) {
      if (!user || !chat) return null
      return (
        (await safe('decide', async () => {
          const c = fresh()
          const pre = decide(c, bot, salt, user, chat, code, undefined)
          if (!pre?.promo) return pre
          const last = Number(
            (await store.get(`shown:${pre.campaign}:${pre.unit}`)) || NaN
          )
          const d = decide(
            c,
            bot,
            salt,
            user,
            chat,
            code,
            Number.isNaN(last) ? undefined : last
          )
          if (d?.promo)
            await store.set(`shown:${d.campaign}:${d.unit}`, String(Date.now()))
          return d
        })) ?? null
      )
    },
    // After the reply went out: seen once a day per user, shown each time
    async record(d: Decision | null | undefined) {
      if (!d) return
      await safe('record', async () => {
        const key = `seen:${d.campaign}:${d.unit}`
        if ((await store.get(key)) !== day()) {
          await store.set(key, day())
          push({ c: d.campaign, v: d.arm, u: d.unit, k: 'seen' })
        }
        if (d.promo) push({ c: d.campaign, v: d.arm, u: d.unit, k: 'shown' })
      })
    },
    // A private chat blocked the bot (my_chat_member → kicked): one blocked
    // event per campaign this bot runs, in the user's arm (holdout too), so
    // harm is treatment against holdout
    blocked(user: number | undefined) {
      const c = fresh()
      if (!user || !salt || !c) return
      for (const k of c.campaigns.filter(
        (k) => k.bot === bot && k.status !== 'stopped'
      ))
        push({
          c: k.id,
          v: arm(k, user)?.id ?? 'holdout',
          u: unitOf(salt, k.id, user),
          k: 'blocked',
        })
    },
    // Another bot's campaign brought this user (/start <payload>): start each
    // time (the numbers count distinct people), new when the chat is new here
    async arrived(
      user: number | undefined,
      payload: string | undefined,
      isNew: boolean
    ) {
      const m = ARRIVAL.exec(payload || '')
      if (!m || !user || !salt) return
      const base = { c: m[1]!, v: m[2]!, u: unitOf(salt, m[1]!, user) }
      push({ ...base, k: 'start' })
      if (isNew) push({ ...base, k: 'new' })
      await safe('arrival', async () => {
        if (!(await store.get(`arrival:${user}`)))
          await store.set(
            `arrival:${user}`,
            JSON.stringify({ payload, at: Date.now() })
          )
      })
    },
    // The bot's main action in the 7 days after an arrival: use, once a day
    async used(user: number | undefined) {
      if (!user || !salt) return
      await safe('use', async () => {
        const raw = await store.get(`arrival:${user}`)
        if (!raw) return
        const a = JSON.parse(raw) as {
          payload: string
          at: number
          used?: string
        }
        if (Date.now() - a.at > WEEK || a.used === day()) return
        await store.set(
          `arrival:${user}`,
          JSON.stringify({ ...a, used: day() })
        )
        const [, c, v] = ARRIVAL.exec(a.payload)!
        push({ c: c!, v: v!, u: unitOf(salt, c!, user), k: 'use' })
      })
    },
    // for tests
    _state: () => ({ cfg, salt, queue }),
  }
}

// /start <payload> from a message text
export const startPayload = (text: string | undefined) =>
  /^\/start(?:@\w+)?\s+(\S+)$/.exec((text || '').trim())?.[1]

// A Store on a MongoDB collection (mongoose: connection.collection('promos'))
export const mongoStore = (col: {
  findOne(q: object): Promise<{ v?: string } | null>
  updateOne(q: object, u: object, o: object): Promise<unknown>
}): Store => ({
  get: async (k) => (await col.findOne({ _id: k }))?.v,
  set: async (k, v) => {
    await col.updateOne(
      { _id: k },
      { $set: { v, at: new Date() } },
      { upsert: true }
    )
  },
})
