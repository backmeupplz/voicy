import { InlineKeyboard } from 'grammy'
import Context from '@/models/Context'
import engines from '@/engines'
import logAnswerTime from '@/helpers/logAnswerTime'

export default async function handleEngine(ctx: Context) {
  const keyboard = new InlineKeyboard()
  for (const engine of Object.values(engines)) {
    keyboard.add({
      text: engine.name,
      callback_data: engine.code,
    })
    keyboard.row()
  }
  await ctx.reply(ctx.i18n.t('engine'), {
    reply_markup: keyboard,
    parse_mode: 'Markdown',
    reply_to_message_id: ctx.msg?.message_id,
  })
  logAnswerTime(ctx, '/engine')
}
