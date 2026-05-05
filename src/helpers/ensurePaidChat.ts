import { isTranscriptionAllowedByDonationWall } from '@/helpers/donationWall'
import { markdownI18n } from '@/helpers/telegramMarkdown'
import Context from '@/models/Context'

export default async function ensurePaidChat(ctx: Context) {
  if (isTranscriptionAllowedByDonationWall(ctx.dbchat)) {
    return true
  }
  await ctx.reply(markdownI18n(ctx, 'sunsetting'), {
    parse_mode: 'Markdown',
    reply_to_message_id: ctx.msg.message_id,
    disable_web_page_preview: true,
  })
  return false
}
