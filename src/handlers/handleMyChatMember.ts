import { markChatReachable } from '@/helpers/chatReachability'
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
  if (!botCanSendAfterMemberUpdate(ctx)) {
    return
  }
  await markChatReachable(ctx, 'my_chat_member')
  return sendLanguage(ctx)
}
