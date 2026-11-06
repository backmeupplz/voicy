import { markChatReachable } from '@/helpers/chatReachability'
import Context from '@/models/Context'

export default async function handlePrivacy(ctx: Context) {
  // what group promos do (promo.ts), before the shared policy
  await ctx.reply(
    `${ctx.i18n.t('privacy_promos')}\n\nhttps://privacy.borodutch.com`
  )
  await markChatReachable(ctx, '/privacy')
}
