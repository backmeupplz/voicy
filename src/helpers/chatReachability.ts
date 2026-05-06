import { Chat, ChatModel } from '@/models/Chat'
import { DocumentType } from '@typegoose/typegoose'
import Context from '@/models/Context'

export enum TelegramReachabilityFailureKind {
  permanent = 'permanent',
  staleStatusMessage = 'stale_status_message',
  benign = 'benign',
  transient = 'transient',
}

interface TelegramReachabilityFailure {
  kind: TelegramReachabilityFailureKind
  code?: number
  description: string
  reason: string
}

type ChatReachabilityUpdate = {
  location: string
  action?: string
}

const permanentSendFailurePatterns = [
  'not enough rights to send text messages',
  'not enough rights to send messages',
  'not enough rights to send a message',
  'have no rights to send a message',
  'bot was kicked',
  'bot was blocked by the user',
  'chat not found',
  'forbidden: bot',
  'forbidden: user is deactivated',
  'forbidden: the group chat was deleted',
  'forbidden: the supergroup chat was deleted',
]

function telegramErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') {
    return undefined
  }
  const candidate = error as {
    error_code?: unknown
    errorCode?: unknown
    code?: unknown
  }
  if (typeof candidate.error_code === 'number') {
    return candidate.error_code
  }
  if (typeof candidate.errorCode === 'number') {
    return candidate.errorCode
  }
  if (typeof candidate.code === 'number') {
    return candidate.code
  }
  return undefined
}

function telegramErrorDescription(error: unknown) {
  if (!error || typeof error !== 'object') {
    return String(error || '')
  }
  const candidate = error as { description?: unknown; message?: unknown }
  if (typeof candidate.description === 'string') {
    return candidate.description
  }
  if (typeof candidate.message === 'string') {
    return candidate.message
  }
  return String(error)
}

function compactTelegramFailureReason(
  failure: TelegramReachabilityFailure,
  location: string
) {
  return `${location}: ${failure.code || 'no-code'} ${failure.description}`
}

function normalizedDescription(error: unknown) {
  return telegramErrorDescription(error).toLowerCase()
}

export function classifyTelegramReachabilityFailure(
  error: unknown
): TelegramReachabilityFailure {
  const code = telegramErrorCode(error)
  const description = telegramErrorDescription(error)
  const normalized = normalizedDescription(error)

  if (normalized.includes('message is not modified')) {
    return {
      kind: TelegramReachabilityFailureKind.benign,
      code,
      description,
      reason: 'message_not_modified',
    }
  }

  if (
    normalized.includes('message to edit not found') ||
    normalized.includes("message can't be edited") ||
    normalized.includes('message identifier is not specified')
  ) {
    return {
      kind: TelegramReachabilityFailureKind.staleStatusMessage,
      code,
      description,
      reason: 'stale_status_message',
    }
  }

  if (
    permanentSendFailurePatterns.some((pattern) => normalized.includes(pattern))
  ) {
    return {
      kind: TelegramReachabilityFailureKind.permanent,
      code,
      description,
      reason: 'permanent_send_permission_failure',
    }
  }

  if (code === 403) {
    return {
      kind: TelegramReachabilityFailureKind.permanent,
      code,
      description,
      reason: 'telegram_forbidden',
    }
  }

  return {
    kind: TelegramReachabilityFailureKind.transient,
    code,
    description,
    reason: 'transient_or_unknown_telegram_failure',
  }
}

export function chatCanQueueTranscriptions(chat: DocumentType<Chat>) {
  return (
    chat.transcriptionDisabledUntilReachable !== true &&
    chat.botCanSendMessages !== false
  )
}

export async function markChatUnreachableForTelegramError(
  ctx: Context | undefined,
  error: unknown,
  update: ChatReachabilityUpdate
) {
  if (!ctx?.dbchat) {
    return false
  }

  const failure = classifyTelegramReachabilityFailure(error)
  if (failure.kind !== TelegramReachabilityFailureKind.permanent) {
    return false
  }

  await markChatUnreachable(ctx.dbchat, failure, update)
  return true
}

export async function markChatUnreachableByIdForTelegramError(
  chatId: string,
  error: unknown,
  update: ChatReachabilityUpdate
) {
  const failure = classifyTelegramReachabilityFailure(error)
  if (failure.kind !== TelegramReachabilityFailureKind.permanent) {
    return false
  }

  const now = new Date()
  await ChatModel.findOneAndUpdate(
    { id: chatId },
    {
      $set: {
        botCanSendMessages: false,
        transcriptionDisabledUntilReachable: true,
        transcriptionUnreachableReason: compactTelegramFailureReason(
          failure,
          update.location
        ),
        transcriptionUnreachableAt: now,
      },
    }
  )
  logUnreachable(chatId, failure, update)
  return true
}

async function markChatUnreachable(
  chat: DocumentType<Chat>,
  failure: TelegramReachabilityFailure,
  update: ChatReachabilityUpdate
) {
  chat.botCanSendMessages = false
  chat.transcriptionDisabledUntilReachable = true
  chat.transcriptionUnreachableReason = compactTelegramFailureReason(
    failure,
    update.location
  )
  chat.transcriptionUnreachableAt = new Date()
  await chat.save()
  logUnreachable(chat.id, failure, update)
}

function logUnreachable(
  chatId: string,
  failure: TelegramReachabilityFailure,
  update: ChatReachabilityUpdate
) {
  console.warn(
    `Marked chat ${chatId} unreachable for transcription at ${update.location}${
      update.action ? `/${update.action}` : ''
    }: ${failure.reason}`
  )
}

export async function markChatReachable(ctx: Context, location: string) {
  if (!ctx.dbchat) {
    return
  }

  if (
    !ctx.dbchat.transcriptionDisabledUntilReachable &&
    ctx.dbchat.botCanSendMessages !== false
  ) {
    return
  }

  ctx.dbchat.botCanSendMessages = true
  ctx.dbchat.transcriptionDisabledUntilReachable = false
  ctx.dbchat.transcriptionReachableAt = new Date()
  ctx.dbchat.transcriptionUnreachableReason = undefined
  await ctx.dbchat.save()
  console.info(`Marked chat ${ctx.dbchat.id} reachable at ${location}`)
}
