import Context from '@/models/Context'
import logAnswerTime from '@/helpers/logAnswerTime'

export default async function handleTranscribeAll(ctx: Context) {
  ctx.dbchat.transcribeAllAudio = !ctx.dbchat.transcribeAllAudio
  await ctx.dbchat.save()
  await ctx.reply(
    ctx.i18n.t(
      !ctx.dbchat.transcribeAllAudio
        ? 'transcribe_all_false'
        : 'transcribe_all_true'
    ),
    {
      parse_mode: 'Markdown',
    }
  )
  logAnswerTime(ctx, 'handleTranscribeAll')
}
