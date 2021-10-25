import { ChatModel } from '@/models/Chat'
import { NextFunction } from 'grammy'
import Context from '@/models/Context'

export default async function attachChat(ctx: Context, next: NextFunction) {
  if (!ctx.chat?.id) {
    return
  }
  const { doc } = await ChatModel.findOrCreate({ id: ctx.chat.id })
  ctx.dbchat = doc
  return next()
}
