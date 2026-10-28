import { createHash } from 'crypto'
import Context from '@/models/Context'
import axios from 'axios'

// Nikita's other bots link here as t.me/voicybot?start=<campaign>-<variant>
// (cross-promo experiments, Prime Radiant's go/campaigns.json). The /start
// is reported to the experiment with the same salted user hash the other bot
// used, never the Telegram id, so it can count who came from which variant.
const START =
  /^\/start(?:@\w+)?\s+([a-z0-9][a-z0-9-]{0,39})-(holdout|[a-z0-9]{1,8})$/

export function promoStartEvent(
  text: string | undefined,
  userId: number | undefined,
  token: string | undefined
) {
  const match = START.exec((text || '').trim())
  if (!match || !userId || !token) return undefined
  const [, c, v] = match
  const u = createHash('sha256')
    .update(`${token}:${c}:${userId}`)
    .digest('hex')
    .slice(0, 16)
  return { c, v, k: 'start', u, b: 'voicy', t: Math.floor(Date.now() / 1000) }
}

export default function reportPromoStart(ctx: Context) {
  if (ctx.chat?.type !== 'private') return
  const event = promoStartEvent(
    ctx.message?.text,
    ctx.from?.id,
    process.env.PROMO_TOKEN
  )
  if (!event) return
  void axios
    .post(
      process.env.PROMO_EVENTS_URL || 'https://lumen.borodutch.com/go/events',
      { events: [event] },
      {
        headers: { Authorization: `Bearer ${process.env.PROMO_TOKEN}` },
        timeout: 10_000,
      }
    )
    .catch((error) => console.error('promo start', error?.message))
}
