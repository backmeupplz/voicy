import engines from '@/engines'
import logAnswerTime from '@/helpers/logAnswerTime'
import Context from '@/models/Context'
import { InlineKeyboard } from 'grammy'

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
    reply_to_message_id: ctx.message.message_id,
  })
  logAnswerTime(ctx, '/engine')
}
