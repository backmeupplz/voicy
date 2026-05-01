import Context from '@/models/Context'
import toggleChatBoolean from '@/helpers/toggleChatBoolean'

export default async function handleSilent(ctx: Context) {
  await toggleChatBoolean(ctx, {
    setting: 'silent',
    messageForValue: (silent) => (silent ? 'silent_true' : 'silent_false'),
    logLabel: '/silent',
  })
}
