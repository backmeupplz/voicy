import Context from '@/models/Context'
import logAnswerTime from '@/helpers/logAnswerTime'

export default async function handleGoogle(ctx: Context) {
  const sentMessage = await ctx.reply(ctx.i18n.t('google'), {
    parse_mode: 'Markdown',
  })
  ctx.dbchat.googleSetupMessageId = sentMessage.message_id
  await ctx.dbchat.save()
  logAnswerTime(ctx, '/google')
}
