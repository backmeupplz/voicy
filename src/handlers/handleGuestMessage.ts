import { ChatModel } from '@/models/Chat'
import { NextFunction } from 'grammy'
import {
  answerGuestQueryWithText,
  guestCallerUser,
  guestChatRecordId,
  guestMessageFromContext,
} from '@/helpers/telegramGuestMode'
import { enqueueTranscription } from '@/handlers/handleAudio'
import { isMediaTooLarge } from '@/helpers/mediaSizeLimit'
import { markdownI18n } from '@/helpers/telegramMarkdown'
import { transcribableMediaFromMessage } from '@/helpers/transcribableTelegramMedia'
import Context from '@/models/Context'
import i18n from '@/helpers/i18n'
import report from '@/helpers/report'

export default async function handleGuestMessage(
  ctx: Context,
  next: NextFunction
) {
  const guestMessage = guestMessageFromContext(ctx)
  if (!guestMessage) {
    return next()
  }

  if (!guestMessage.guest_query_id) {
    console.warn('Ignoring guest message without guest_query_id')
    return undefined
  }

  const caller = guestCallerUser(guestMessage)
  if (caller?.is_bot || guestMessage.from?.is_bot) {
    console.info('Ignoring bot-origin guest message')
    return undefined
  }

  const { doc: dbchat } = await ChatModel.findOrCreate({
    id: guestChatRecordId(guestMessage),
  })
  const guestCtx = guestContext(ctx, guestMessage, dbchat)
  const sourceMessage = guestMessage.reply_to_message
  const media = sourceMessage
    ? transcribableMediaFromMessage(sourceMessage)
    : undefined

  try {
    if (!sourceMessage || !media) {
      await answerGuestQueryWithText(
        guestCtx,
        guestMessage.guest_query_id,
        markdownI18n(guestCtx, 'guest_reply_to_media'),
        { parse_mode: 'Markdown' }
      )
      return undefined
    }

    if (isMediaTooLarge(media.file_size)) {
      await answerGuestQueryWithText(
        guestCtx,
        guestMessage.guest_query_id,
        markdownI18n(guestCtx, 'error_twenty'),
        { parse_mode: 'Markdown' }
      )
      return undefined
    }

    await enqueueTranscription(
      guestCtx,
      media.file_id,
      sourceMessage,
      undefined,
      { guestQueryId: guestMessage.guest_query_id }
    )
  } catch (error) {
    report(error, { ctx: guestCtx, location: 'handleGuestMessage' })
    try {
      await answerGuestQueryWithText(
        guestCtx,
        guestMessage.guest_query_id,
        markdownI18n(guestCtx, 'error_queue'),
        { parse_mode: 'Markdown' }
      )
    } catch (replyError) {
      report(replyError, {
        ctx: guestCtx,
        location: 'handleGuestMessage.errorReply',
      })
    }
  }

  return undefined
}

function guestContext(
  ctx: Context,
  guestMessage: NonNullable<ReturnType<typeof guestMessageFromContext>>,
  dbchat: Context['dbchat']
) {
  const guestCtx = Object.create(ctx) as Context
  guestCtx.dbchat = dbchat
  guestCtx.timeReceived = ctx.timeReceived || new Date()

  Object.defineProperties(guestCtx, {
    chat: { value: guestMessage.chat },
    from: { value: guestCallerUser(guestMessage) },
    i18n: {
      value: {
        locale: () => dbchat.uiLanguage || 'en',
        t: (key: string, replacements?: Record<string, string | number>) =>
          i18n.t(dbchat.uiLanguage || 'en', key, replacements),
      } as Context['i18n'],
    },
    message: { value: guestMessage },
    msg: { value: guestMessage },
  })

  return guestCtx
}
