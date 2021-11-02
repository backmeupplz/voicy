import Context from '@/models/Context'
import bot from '@/helpers/bot'

const ignoredMessages = [
  'have no rights to send a message',
  'You have exceeded the limit of 60 requests per minute for your app',
  "message can't be deleted",
  'message is not modified',
  'replied message not found',
  'CHAT_WRITE_FORBIDDEN',
  'message to edit not found',
  'Exceeded max audio length of 20 seconds',
  'Response code 404 (Not Found)',
  'Too Many Requests: retry after',
  'You have exceeded the limit of 240 requests',
  'MESSAGE_ID_INVALID',
  'bot was kicked from the supergroup chat',
  'The project to be billed is associated with a delinquent billing account',
  'need administrator rights',
  'You have exceeded the limit of 180 requests',
  'The project to be billed is associated with a closed billing account',
  'wrong file_id or the file is temporarily unavailable',
  'not enough rights to send text messages',
  'bot was blocked by the user',
  'bot was kicked from the group chat',
  'bot is not a member of the supergroup chat',
  'The project to be billed is associated with an absent billing',
  'Bad Request: not Found',
  'account not found',
  'Request Entity Too Large',
]

interface ExtraErrorInfo {
  ctx?: Context
  location?: string
  meta?: string
}

function constructErrorMessage(
  error: Error,
  { ctx, location, meta }: ExtraErrorInfo
) {
  const { message, stack } = error
  const chatInfo = ctx ? [`Chat <b>${ctx.chat.id}</b>`] : []
  if (ctx && 'username' in ctx.chat) {
    chatInfo.push(`@${ctx.chat.username}`)
  }
  if (ctx && ctx.dbchat) {
    chatInfo.push(ctx.dbchat.engine)
    chatInfo.push(ctx.dbchat.languages[ctx.dbchat.engine])
  }
  return `${
    location ? `<b>${escape(location)}</b>${ctx ? '\n' : ''}` : ''
  }${chatInfo.filter((v) => !!v).join(', ')}\n${escape(message)}${
    meta ? `${meta}\n` : ''
  }\n<code>${escape(stack)}</code>`
}

async function sendToTelegramAdmin(error: Error, info: ExtraErrorInfo) {
  try {
    if (
      process.env.ENVIRONMENT !== 'development' &&
      ignoredMessages.find((m) => error.message.includes(m))
    ) {
      return
    }
    const message = constructErrorMessage(error, info)
    await bot.api.sendMessage(process.env.ADMIN_ID, message, {
      parse_mode: 'HTML',
    })
    if (info.ctx) {
      await info.ctx.forwardMessage(process.env.ADMIN_ID)
    }
  } catch (sendError) {
    console.error('Error reporting:', sendError)
  }
}

export default function report(error: Error, info: ExtraErrorInfo = {}) {
  void sendToTelegramAdmin(error, info)
}

function escape(s: string) {
  return s.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&/g, '&amp;')
}
