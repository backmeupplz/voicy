import Context from '@/models/Context'
import logAnswerTime from '@/helpers/logAnswerTime'

type BooleanChatSetting = 'filesBanned' | 'silent' | 'transcribeAllAudio'

interface ToggleChatBooleanOptions {
  setting: BooleanChatSetting
  messageForValue: (value: boolean) => string
  logLabel: string
}

export default async function toggleChatBoolean(
  ctx: Context,
  { setting, messageForValue, logLabel }: ToggleChatBooleanOptions
) {
  ctx.dbchat[setting] = !ctx.dbchat[setting]
  await ctx.dbchat.save()
  await ctx.reply(ctx.i18n.t(messageForValue(ctx.dbchat[setting])), {
    parse_mode: 'Markdown',
  })
  logAnswerTime(ctx, logLabel)
}
