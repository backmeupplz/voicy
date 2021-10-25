import Context from '@/models/Context'
import sendLanguage from '@/helpers/language/sendLanguage'

export default function handleMyChatMember(ctx: Context) {
  if (ctx.myChatMember.new_chat_member.status !== 'member') {
    return
  }
  return sendLanguage(ctx)
}
