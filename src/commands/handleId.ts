import Context from '@/models/Context'
import logAnswerTime from '@/helpers/logAnswerTime'

export function idCommandText(ctx: Pick<Context, 'chat' | 'from'>) {
  const chatId = ctx.chat?.id ?? 'unavailable'
  const userId = ctx.from?.id ?? 'unavailable'

  return `chat id: ${chatId}\nuser id: ${userId}`
}

export default async function handleId(ctx: Context) {
  await ctx.reply(idCommandText(ctx))
  logAnswerTime(ctx, '/id')
}
