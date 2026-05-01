import Context from '@/models/Context'

export default async function ensurePaidChat(ctx: Context) {
  if (ctx.dbchat.paid) {
    return true
  }
  await ctx.reply(ctx.i18n.t('sunsetting'), {
    parse_mode: 'Markdown',
    reply_to_message_id: ctx.msg.message_id,
    disable_web_page_preview: true,
  })
  return false
}
