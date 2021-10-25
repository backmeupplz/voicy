import engines from '@/engines'
import Engine from '@/helpers/engine/Engine'
import logAnswerTime from '@/helpers/logAnswerTime'
import Context from '@/models/Context'

export default async function handleSetEngine(ctx: Context) {
  const engineCode = ctx.callbackQuery.data
  ctx.dbchat.engine = engineCode as Engine
  await ctx.dbchat.save()
  const engineObject = engines[engineCode]
  await ctx.editMessageText(
    ctx.i18n.t('engine_success', { engine: engineObject.name }),
    {
      parse_mode: 'Markdown',
    }
  )
  if (engineObject.messageWhenEngineIsSet) {
    await ctx.reply(engineObject.messageWhenEngineIsSet, {
      parse_mode: 'Markdown',
    })
  }
  await ctx.answerCallbackQuery()
  logAnswerTime(ctx, 'setting engine')
}
