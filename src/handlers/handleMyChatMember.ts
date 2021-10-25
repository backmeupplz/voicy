import sendLanguage from '@/helpers/language/sendLanguage'
import Context from '@/models/Context'

export default function handleMyChatMember(ctx: Context) {
  if (ctx.myChatMember.new_chat_member.status !== 'member') {
    return
  }
  return sendLanguage(ctx)
}
