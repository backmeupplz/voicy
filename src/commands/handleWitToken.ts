import logAnswerTime from '@/helpers/logAnswerTime'
import Context from '@/models/Context'

export default async function handleWitToken(ctx: Context) {
  const witToken = ctx.message.text.split(' ')[1]
  if (!witToken) {
    ctx.dbchat.witToken = undefined
  } else {
    ctx.dbchat.witToken = witToken
  }
  await ctx.dbchat.save()
  await ctx.reply('👍')
  logAnswerTime(ctx, '/witToken')
}
