import Context from '@/models/Context'
import toggleChatBoolean from '@/helpers/toggleChatBoolean'

export default async function handleFiles(ctx: Context) {
  await toggleChatBoolean(ctx, {
    setting: 'filesBanned',
    messageForValue: (filesBanned) =>
      filesBanned ? 'files_false' : 'files_true',
    logLabel: '/files',
  })
}
