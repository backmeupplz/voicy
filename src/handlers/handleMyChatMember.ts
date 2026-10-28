import { markChatReachable } from '@/helpers/chatReachability'
import { promoHook } from '@/helpers/promoHost'
import { recordBroadcastBlock } from '@/helpers/broadcast'
import Context from '@/models/Context'
import sendLanguage from '@/helpers/language/sendLanguage'

function botCanSendAfterMemberUpdate(ctx: Context) {
  const member = ctx.myChatMember.new_chat_member as {
    status: string
    can_send_messages?: boolean
  }

  if (member.status === 'administrator' || member.status === 'member') {
    return true
  }

  return member.status === 'restricted' && member.can_send_messages === true
}

export default async function handleMyChatMember(ctx: Context) {
  // a private chat blocked Voicy: harm numbers for the reply promos
  if (
    ctx.chat?.type === 'private' &&
    ctx.myChatMember.new_chat_member.status === 'kicked'
  )
    promoHook.blocked(ctx.from?.id)
  await recordBroadcastBlock(ctx).catch((error) =>
    console.error('broadcast block', error?.message)
  )
  if (!botCanSendAfterMemberUpdate(ctx)) {
    return
  }
  await markChatReachable(ctx, 'my_chat_member')
  return sendLanguage(ctx)
}
