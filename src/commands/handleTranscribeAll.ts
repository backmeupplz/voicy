import Context from '@/models/Context'
import toggleChatBoolean from '@/helpers/toggleChatBoolean'

export default async function handleTranscribeAll(ctx: Context) {
  await toggleChatBoolean(ctx, {
    setting: 'transcribeAllAudio',
    messageForValue: (transcribeAllAudio) =>
      transcribeAllAudio ? 'transcribe_all_true' : 'transcribe_all_false',
    logLabel: 'handleTranscribeAll',
  })
}
