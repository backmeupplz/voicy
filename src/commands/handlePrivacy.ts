import { markChatReachable } from '@/helpers/chatReachability'
import Context from '@/models/Context'

export default async function handlePrivacy(ctx: Context) {
  await ctx.reply('https://privacy.borodutch.com')
  await markChatReachable(ctx, '/privacy')
}
