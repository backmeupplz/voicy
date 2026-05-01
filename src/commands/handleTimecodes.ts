import Context from '@/models/Context'
import toggleChatBoolean from '@/helpers/toggleChatBoolean'

export default async function handleTimecodes(ctx: Context) {
  await toggleChatBoolean(ctx, {
    setting: 'timecodesEnabled',
    messageForValue: (timecodesEnabled) =>
      timecodesEnabled ? 'timecodes_true' : 'timecodes_false',
    logLabel: '/timecodes',
  })
}
