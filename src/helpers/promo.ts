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
//
// Groups (approvals.md, 2026-11-06): only campaigns with chats ["group"], only
// as a button on a reply the bot already sends there, and only when the message
// it answers (its text, caption or transcript) matches one of the campaign's
// topic keywords. The text is matched in memory and never kept or logged. The
// unit is the group: its arm comes from a salted hash of the group id, events
// carry a salted group hash, at most one promo per group per 7 days, and a
// group admin can turn promos off for the group (/promos off: optout). The
// bot being removed from a group (left or kicked) is reported as removed, in
// the group's arm, so harm is treatment groups against holdout groups.

import { createHash } from 'crypto'
import axios from 'axios'

const STALE = 3600_000
const DAY = 86400_000
const WEEK = 7 * DAY
export const GROUP_DAYS = 7

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
  // group campaigns: keywords per language for the target's topic
  topics?: Record<string, string[]>
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
type Kind =
  | 'seen'
  | 'shown'
  | 'start'
  | 'new'
  | 'use'
  | 'blocked'
  | 'removed'
  | 'optout'
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

// Variants take their shares from 0 up, the rest is holdout
function pick(c: Campaign, b: number) {
  let edge = 0
  for (const v of c.variants) if (b < (edge += v.share)) return v
  return undefined
}

// The user's arm
export const arm = (c: Campaign, user: number) => pick(c, bucket(c.id, user))

// A group's arm: by a salted hash of the group id
export const groupArm = (c: Campaign, salt: string, chat: number) =>
  pick(
    c,
    parseInt(sha(`${salt}:group:${c.id}:${chat}`).slice(0, 8), 16) / 2 ** 32
  )

// The salted hash events carry for a user (or, in groups, the group)
export const unitOf = (salt: string, campaign: string, user: number) =>
  sha(`${salt}:${campaign}:${user}`).slice(0, 16)

// Telegram's chat types as campaigns name them: a supergroup is a group too
export const chatKind = (type: string | undefined) =>
  type === 'supergroup' ? 'group' : type

const LETTER = new RegExp('[\\p{L}\\p{N}_]', 'u')
const fold = (s: string) => s.normalize('NFKC').toLowerCase().replace(/ё/g, 'е')

// Whether a message touches one of a campaign's topic keywords (any language):
// a keyword matches at the start of a word, so "download" finds "downloading"
// and "youtu.be" finds a link. Case- and ё-insensitive. Pure: the text is
// neither kept nor logged.
export function topical(
  text: string | undefined,
  topics: Record<string, string[]> | undefined
) {
  if (!text || !topics) return false
  const t = fold(text)
  for (const lang of Object.keys(topics))
    for (const word of topics[lang] || []) {
      const k = fold(word).trim()
      if (!k) continue
      for (let i = t.indexOf(k); i >= 0; i = t.indexOf(k, i + 1))
        if (i === 0 || !LETTER.test(t.charAt(i - 1))) return true
    }
  return false
}

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
  // groups only through decideGroup (topics, the group's arm)
  if (
    !cfg ||
    !salt ||
    cfg.bots?.[bot]?.enabled !== true ||
    chatKind(chat) === 'group'
  )
    return null
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

// What to do for one reply in a group: null = the message matches no group
// campaign's topics (log nothing). lastShown is the group's last promo from any
// campaign: at most one per GROUP_DAYS (or the campaign's cap_days if longer).
export function decideGroup(
  cfg: Config | undefined,
  bot: string,
  salt: string,
  chat: number,
  code: string | undefined,
  text: string | undefined,
  lastShown: number | undefined,
  now = Date.now()
): Decision | null {
  if (!cfg || !salt || !chat || cfg.bots?.[bot]?.enabled !== true) return null
  const l = baseLang(code)
  const c = cfg.campaigns.find(
    (c) =>
      usable(cfg, bot, c) &&
      c.chats.includes('group') &&
      c.langs.includes(l) &&
      c.text[l] &&
      c.variants.every((v) => v.format === 'button') &&
      topical(text, c.topics)
  )
  if (!c) return null
  const unit = unitOf(salt, c.id, chat)
  const v = groupArm(c, salt, chat)
  if (!v) return { campaign: c.id, arm: 'holdout', unit }
  const capped =
    lastShown !== undefined &&
    now - lastShown < Math.max(c.cap_days, GROUP_DAYS) * DAY
  return {
    campaign: c.id,
    arm: v.id,
    unit,
    promo: capped
      ? undefined
      : {
          text: v.text?.[l] ?? c.text[l]!,
          url: link(cfg, bot, c, v, unit)!,
          format: 'button',
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
  // groups handed a promo in this process: two replies at once still get one.
  // A reservation until record() says the button went out (then it's stored
  // as group-shown) or release() says it didn't.
  const recent = new Map<number, number>()
  const pending = new WeakMap<Decision, { chat: number; at: number }>()
  // removals and opt-outs that came before the config and salt were there
  let deferred: { k: 'removed' | 'optout'; chat: number }[] = []

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
    const later = deferred
    deferred = []
    for (const e of later) await groupEvent(e.k, e.chat)
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

  // removed or optout, in the group's arm, for each group campaign this bot
  // runs (removed only where the group was seen); kept for later while the
  // config or the salt isn't there
  async function groupEvent(k: 'removed' | 'optout', chat: number) {
    const c = fresh()
    if (off || !token) return
    if (!salt || !c) {
      deferred = [...deferred, { k, chat }].slice(-5_000)
      return
    }
    try {
      for (const x of c.campaigns.filter(
        (x) =>
          x.bot === bot && x.status !== 'stopped' && x.chats.includes('group')
      )) {
        const u = unitOf(salt, x.id, chat)
        if (k === 'optout' || (await store.get(`seen:${x.id}:${u}`)))
          push({ c: x.id, v: groupArm(x, salt, chat)?.id ?? 'holdout', u, k })
      }
    } catch (e) {
      console.error(`promo ${k}`, (e as Error).message)
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
    // After the reply went out: seen once a day per unit, shown each time.
    // shown = false: the reply went out without the promo (a group's cap
    // isn't used up then).
    async record(d: Decision | null | undefined, shown = true) {
      if (!d) return
      const p = pending.get(d)
      pending.delete(d)
      const promo = shown ? d.promo : undefined
      if (p && !promo && recent.get(p.chat) === p.at) recent.delete(p.chat)
      // the button already went out: a failed store write never loses the
      // events (seen goes out again if its once-a-day mark can't be read)
      if (p && promo)
        await safe('record', () =>
          store.set(`group-shown:${p.chat}`, String(p.at))
        )
      const key = `seen:${d.campaign}:${d.unit}`
      const first = await safe('record', async () => {
        if ((await store.get(key)) === day()) return false
        await store.set(key, day())
        return true
      })
      if (first !== false)
        push({ c: d.campaign, v: d.arm, u: d.unit, k: 'seen' })
      if (promo) push({ c: d.campaign, v: d.arm, u: d.unit, k: 'shown' })
    },
    // The reply carrying a group decision never went out: no events, and the
    // group's cap isn't used up
    release(d: Decision | null | undefined) {
      const p = d ? pending.get(d) : undefined
      if (!d || !p) return
      pending.delete(d)
      if (recent.get(p.chat) === p.at) recent.delete(p.chat)
    },
    // The promo for a reply about to go out in a group, or null. The text is
    // the message the reply answers (its text, caption or transcript): it is
    // only matched against the campaigns' topics, here, in memory. A promo
    // holds the group's cap in this process at once, and uses it up when
    // record() says it went out (release() if the reply failed). Never throws.
    async group(
      chat: number | undefined,
      type: string | undefined,
      code: string | undefined,
      text: string | undefined
    ) {
      if (!chat || !text || chatKind(type) !== 'group') return null
      return (
        (await safe('group', async () => {
          const c = fresh()
          const pre = decideGroup(c, bot, salt, chat, code, text, undefined)
          if (!pre || (await store.get(`group-off:${chat}`))) return null
          if (!pre.promo) return pre
          const stored = Number((await store.get(`group-shown:${chat}`)) || NaN)
          const last =
            Math.max(
              Number.isNaN(stored) ? 0 : stored,
              recent.get(chat) ?? 0
            ) || undefined
          const d = decideGroup(c, bot, salt, chat, code, text, last)
          if (d?.promo) {
            const now = Date.now()
            recent.set(chat, now) // before the next await: a reply in flight sees it
            pending.set(d, { chat, at: now })
            if (recent.size > 10_000)
              for (const [k, t] of recent)
                if (now - t >= GROUP_DAYS * DAY) recent.delete(k)
          }
          return d
        })) ?? null
      )
    },
    // Whether a group's admins left promos on (/promos); undefined if the
    // store couldn't be read
    async groupOn(chat: number) {
      const r = await safe('group-off', async () => ({
        off: await store.get(`group-off:${chat}`),
      }))
      return r && !r.off
    },
    // A group admin turned promos off (or back on) for the group: true once
    // stored. Off reports optout in the group's arm for each group campaign.
    async setGroup(chat: number, on: boolean) {
      const ok = await safe('group-off', async () => {
        await store.set(`group-off:${chat}`, on ? '' : '1')
        return true
      })
      if (ok && !on) await groupEvent('optout', chat)
      return ok === true
    },
    // The bot was removed from a group (my_chat_member → left or kicked):
    // removed, in the group's arm (holdout too), for each group campaign that
    // saw the group, so harm is treatment groups against holdout groups
    async removed(chat: number | undefined) {
      if (chat) await groupEvent('removed', chat)
    },
    // A private chat blocked the bot (my_chat_member → kicked): one blocked
    // event per private campaign this bot runs, in the user's arm (holdout
    // too), so harm is treatment against holdout
    blocked(user: number | undefined) {
      const c = fresh()
      if (!user || !salt || !c) return
      for (const k of c.campaigns.filter(
        (k) =>
          k.bot === bot && k.status !== 'stopped' && !k.chats.includes('group')
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
