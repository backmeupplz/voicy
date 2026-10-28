import { ChatModel } from '@/models/Chat'
import { createHash } from 'crypto'
import Context from '@/models/Context'
import axios from 'axios'

// Cross-promo experiments (Prime Radiant's go/campaigns.json). Nikita's other
// bots link here with a native deep link, t.me/voicybot?start=<campaign>-
// <variant>-<source bot> (xp1-a-vdb), and links to @golden_borodutch carry an
// invite link named the same way. Voicy reports to the experiment, with the
// same salted user hash the promoting bot used (never the Telegram id):
// start (any /start with such a payload), new (the chat is new to Voicy),
// use (a voice message in the 7 days after, once a day) and join (someone
// joined the channel through a campaign's invite link).
export const PAYLOAD = /^([a-z0-9]{1,16})-([a-z0-9]{1,8})-([a-z0-9]{1,12})$/
const START = /^\/start(?:@\w+)?\s+(\S+)$/
const DAY = 86_400_000

type Kind = 'start' | 'new' | 'use' | 'join'

export function promoEvent(
  payload: string | undefined,
  kind: Kind,
  userId: number | undefined,
  token: string | undefined
) {
  const match = PAYLOAD.exec(payload || '')
  if (!match || !userId || !token) return undefined
  const [, c, v] = match
  const u = createHash('sha256')
    .update(`${token}:${c}:${userId}`)
    .digest('hex')
    .slice(0, 16)
  return { c, v, k: kind, u, b: 'voicy', t: Math.floor(Date.now() / 1000) }
}

export const startPayload = (text: string | undefined) =>
  START.exec((text || '').trim())?.[1]

function send(events: ReturnType<typeof promoEvent>[]) {
  const token = process.env.PROMO_TOKEN
  const batch = events.filter(Boolean)
  if (!token || !batch.length) return
  void axios
    .post(
      process.env.PROMO_EVENTS_URL || 'https://lumen.borodutch.com/go/events',
      { events: batch },
      { headers: { Authorization: `Bearer ${token}` }, timeout: 10_000 }
    )
    .catch((error) => console.error('promo event', error?.message))
}

export default function reportPromoStart(ctx: Context) {
  const payload = startPayload(ctx.message?.text)
  const token = process.env.PROMO_TOKEN
  const userId = ctx.from?.id
  const chat = ctx.dbchat
  if (ctx.chat?.type !== 'private' || !PAYLOAD.test(payload || '')) return
  const created = (chat as unknown as { createdAt?: Date } | undefined)
    ?.createdAt
  const fresh = created && Date.now() - created.getTime() < 10 * 60_000
  send([
    promoEvent(payload, 'start', userId, token),
    fresh ? promoEvent(payload, 'new', userId, token) : undefined,
  ])
  // first touch: the campaign that brought this chat, for the 7-day use count
  if (chat && !chat.promoCampaign)
    void ChatModel.updateOne(
      { _id: chat._id },
      { promoCampaign: payload, promoStartAt: new Date() }
    ).catch((error) => console.error('promo start', error?.message))
}

// A voice message in a private chat a campaign brought in, within 7 days of
// its /start: reported once a day
export function reportPromoUse(ctx: Context) {
  const chat = ctx.dbchat
  if (ctx.chat?.type !== 'private' || !chat?.promoCampaign) return
  if (!chat.promoStartAt || Date.now() - chat.promoStartAt.getTime() > 7 * DAY)
    return
  const today = new Date().toISOString().slice(0, 10)
  if (chat.promoUseDay === today) return
  chat.promoUseDay = today
  void ChatModel.updateOne({ _id: chat._id }, { promoUseDay: today }).catch(
    (error) => console.error('promo use', error?.message)
  )
  send([
    promoEvent(
      chat.promoCampaign,
      'use',
      ctx.from?.id,
      process.env.PROMO_TOKEN
    ),
  ])
}

// Someone joined @golden_borodutch through an invite link a campaign named
// <campaign>-<variant>-<source bot>. Runs before every other middleware, so
// chat_member updates from groups cost nothing.
export function reportPromoJoin(ctx: Context) {
  const update = ctx.chatMember
  if (!update || update.chat.type !== 'channel') return
  const was = update.old_chat_member.status
  const now = update.new_chat_member.status
  if (!['left', 'kicked'].includes(was) || now !== 'member') return
  send([
    promoEvent(
      update.invite_link?.name,
      'join',
      update.new_chat_member.user.id,
      process.env.PROMO_TOKEN
    ),
  ])
}

// The campaigns' invite links to @golden_borodutch, named in PROMO_INVITE_LINKS
// (comma-separated <campaign>-<variant>-<source bot>): created once by Voicy,
// which is an admin there, kept in Mongo and printed to the log for
// go/campaigns.json. Also logs whether Voicy may create links at all.
export async function ensurePromoInviteLinks(ctx: {
  api: Context['api']
  me: { id: number }
  chatId: string
  names: string[]
}) {
  const names = ctx.names.filter((n) => PAYLOAD.test(n))
  if (!names.length) return
  const me = await ctx.api.getChatMember(ctx.chatId, ctx.me.id)
  const can = me.status === 'administrator' && me.can_invite_users
  console.info(`promo invite links: can_invite_users=${!!can} (${me.status})`)
  if (!can) return
  const links = ChatModel.db.collection('promoinvitelinks')
  for (const name of names) {
    let link = (await links.findOne({ name }))?.link as string | undefined
    if (!link) {
      link = (await ctx.api.createChatInviteLink(ctx.chatId, { name }))
        .invite_link
      await links.insertOne({ name, link, createdAt: new Date() })
    }
    console.info(`promo invite link ${name} ${link}`)
  }
}
