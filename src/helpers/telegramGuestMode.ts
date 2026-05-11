import { Message, ParseMode, User } from '@grammyjs/types'
import Context from '@/models/Context'

export type GuestMessage = Message & {
  guest_query_id?: string
  guest_bot_caller_user?: User
  guest_bot_caller_chat?: {
    id: number | string
    type: string
    title?: string
    username?: string
  }
}

type GuestUpdate = {
  guest_message?: GuestMessage
}

type GuestInlineQueryResultArticle = {
  type: 'article'
  id: string
  title: string
  input_message_content: {
    message_text: string
    parse_mode?: ParseMode
    disable_web_page_preview?: boolean
  }
}

type SentGuestMessage = {
  inline_message_id: string
}

type GuestRawApi = {
  answerGuestQuery(
    payload: {
      guest_query_id: string
      result: GuestInlineQueryResultArticle
    },
    signal?: AbortSignal
  ): Promise<SentGuestMessage>
}

export function guestMessageFromContext(ctx: Context) {
  return (ctx.update as GuestUpdate).guest_message
}

export function guestChatRecordId(message: GuestMessage) {
  return `guest:${message.chat.id}`
}

export function guestCallerUser(message: GuestMessage) {
  return message.guest_bot_caller_user || message.from
}

export async function answerGuestQueryWithText(
  ctx: Context,
  guestQueryId: string,
  text: string,
  options: {
    parse_mode?: ParseMode
    title?: string
    disable_web_page_preview?: boolean
  } = {}
) {
  const result: GuestInlineQueryResultArticle = {
    type: 'article',
    id: guestResultId(guestQueryId),
    title: options.title || 'Voicy',
    input_message_content: {
      message_text: text,
      parse_mode: options.parse_mode,
      disable_web_page_preview: options.disable_web_page_preview ?? true,
    },
  }
  const rawApi = ctx.api.raw as unknown as GuestRawApi
  const sent = await rawApi.answerGuestQuery({
    guest_query_id: guestQueryId,
    result,
  })
  return sent.inline_message_id
}

function guestResultId(guestQueryId: string) {
  const normalized = guestQueryId.replace(/[^a-zA-Z0-9_-]/g, '')
  return (normalized || 'guest').slice(0, 64)
}
