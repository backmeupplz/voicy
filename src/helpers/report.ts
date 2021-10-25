import Context from '@/models/Context'
import bot from '@/helpers/bot'

interface ExtraErrorInfo {
  ctx?: Context
  location?: string
}

function constructErrorMessage(
  error: Error,
  { ctx, location }: ExtraErrorInfo
) {
  const { message, stack } = error
  const chatInfo = [`Chat <b>${ctx.chat.id}</b>, `]
  if ('username' in ctx.chat) {
    chatInfo.push(`@${ctx.chat.username}`)
  }
  return `${location ? `<b>${location}</b>\n` : ''}${chatInfo.join(
    ', '
  )}\n${message}\n<code>${stack}</code>`
}

async function sendToTelegramAdmin(error: Error, info: ExtraErrorInfo) {
  try {
    await bot.api.sendMessage(
      process.env.ADMIN,
      constructErrorMessage(error, info),
      { parse_mode: 'HTML' }
    )
  } catch (sendError) {
    console.error(sendError)
  }
}

export default function report(error: Error, info: ExtraErrorInfo = {}) {
  void sendToTelegramAdmin(error, info)
}
