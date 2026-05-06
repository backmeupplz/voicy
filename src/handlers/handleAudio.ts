import { Message } from '@grammyjs/types'
import {
  TranscribableTelegramFile,
  transcribableMediaFromMessage,
} from '@/helpers/transcribableTelegramMedia'
import {
  TranscriptionAbuseLimitReason,
  checkTranscriptionAbuseLimits,
} from '@/helpers/transcriptionJobs/abuseLimits'
import {
  TranscriptionAccessDenialReason,
  checkTranscriptionAccess,
  refundGoldenBorodutchFreeTranscription,
} from '@/helpers/goldenBorodutchFreeTranscriptions'
import {
  TranscriptionJobModel,
  TranscriptionJobSourceKind,
  TranscriptionJobStatus,
} from '@/models/TranscriptionJob'
import {
  chatCanQueueTranscriptions,
  markChatUnreachableForTelegramError,
} from '@/helpers/chatReachability'
import { markdownI18n } from '@/helpers/telegramMarkdown'
import { transcriptionProgressStatusHtml } from '@/helpers/transcriptionJobs/progressStatusText'
import Context from '@/models/Context'
import report from '@/helpers/report'

export default async function handleAudio(ctx: Context) {
  try {
    if (!chatCanQueueTranscriptions(ctx.dbchat)) {
      console.info(
        `Skipping transcription queue for unreachable chat ${ctx.dbchat.id}`
      )
      return
    }

    const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup'
    if (!ctx.dbchat.transcribeAllAudio && isGroup) {
      console.log('Ignored cause transcribeAllAudio is false')
      return
    }

    const message = ctx.msg
    const audio = transcribableMediaFromMessage(message)
    if (!audio) {
      return
    }
    if (isMediaTooLarge(audio.file_size)) {
      if (!ctx.dbchat.silent) {
        await sendLargeFileError(ctx)
      }
      return
    }

    await enqueueTranscription(ctx, audio.file_id, message)
  } catch (error) {
    report(error, { ctx, location: 'handleMessage' })
    if (!ctx.dbchat.silent) {
      await sendQueueError(ctx)
    }
  }
}

function maxMediaFileSizeBytes() {
  const configuredMb = Number(process.env.VOICY_MAX_MEDIA_FILE_SIZE_MB || 20)
  if (!Number.isFinite(configuredMb) || configuredMb <= 0) {
    return undefined
  }
  return configuredMb * 1024 * 1024
}

function isMediaTooLarge(fileSize?: number) {
  const limit = maxMediaFileSizeBytes()
  return Boolean(limit && fileSize && fileSize >= limit)
}

async function enqueueTranscription(
  ctx: Context,
  fileId: string,
  sourceMessage: Message = ctx.msg,
  filePath?: string
) {
  if (!chatCanQueueTranscriptions(ctx.dbchat)) {
    console.info(
      `Skipping transcription queue for unreachable chat ${ctx.dbchat.id}`
    )
    return undefined
  }

  const audio = transcribableMediaFromMessage(sourceMessage)
  if (!audio) {
    throw new Error('No supported audio payload found on message')
  }
  const abuseLimit = await checkTranscriptionAbuseLimits({
    chatId: ctx.dbchat.id,
    userId: ctx.from?.id ? String(ctx.from.id) : undefined,
  })
  if (abuseLimit) {
    if (!ctx.dbchat.silent) {
      await sendTranscriptionLimitError(ctx, abuseLimit.reason, sourceMessage)
    }
    return undefined
  }

  const freeAccessUserId = transcriptionAccessUserId(sourceMessage, ctx)
  const access = await checkTranscriptionAccess({
    chat: ctx.dbchat,
    telegramUserId: freeAccessUserId,
    telegramApi: ctx.api,
  })
  if (!access.allowed) {
    if (!ctx.dbchat.silent) {
      await sendTranscriptionAccessError(ctx, access.reason, sourceMessage)
    }
    return undefined
  }

  let queuedJob
  try {
    queuedJob = await TranscriptionJobModel.create({
      status: TranscriptionJobStatus.queuedForDownload,
      chatId: ctx.dbchat.id,
      telegramChatId: String(ctx.chat.id),
      telegramChatType: ctx.chat.type,
      sourceMessageId: sourceMessage.message_id,
      requestMessageId: ctx.msg?.message_id,
      silent: ctx.dbchat.silent,
      fileId,
      filePath,
      fileSize: audio.file_size,
      mimeType: audio.mime_type,
      fileName: audio.file_name,
      fileUniqueId: fileUniqueId(audio),
      sourceKind: sourceKind(audio.sourceType),
      requestedByUserId: ctx.from?.id ? String(ctx.from.id) : undefined,
      forwardedFromUserId: sourceMessage.forward_from?.id
        ? String(sourceMessage.forward_from.id)
        : undefined,
      forwardSenderName: sourceMessage.forward_sender_name,
      uiLocale: ctx.dbchat.uiLanguage,
    })
  } catch (error) {
    if (access.consumedFreeTranscription && freeAccessUserId) {
      await refundGoldenBorodutchFreeTranscription(freeAccessUserId)
    }
    throw error
  }

  if (ctx.dbchat.silent) {
    await sendSilentTranscriptionChatAction(ctx)
    console.info('Skipping live transcription status message in silent mode')
    return queuedJob
  }

  if (ctx.chat.type === 'channel') {
    console.info('Skipping live transcription status message in channel chat')
    return queuedJob
  }

  try {
    const ackMessage = await ctx.reply(
      transcriptionProgressStatusHtml(
        ctx.dbchat.uiLanguage,
        'progress_processing'
      ),
      {
        reply_to_message_id: sourceMessage.message_id,
        parse_mode: 'HTML',
      }
    )
    queuedJob.statusMessageId = ackMessage.message_id
    await queuedJob.save()
  } catch (error) {
    const markedUnreachable = await markChatUnreachableForTelegramError(
      ctx,
      error,
      { location: 'ackQueuedTranscription', action: 'reply' }
    )
    if (markedUnreachable) {
      queuedJob.status = TranscriptionJobStatus.failed
      queuedJob.failedAt = new Date()
      queuedJob.lastError = 'Telegram chat is unreachable for transcription'
      await queuedJob.save()
    }
    report(error, { ctx, location: 'ackQueuedTranscription' })
  }

  console.info(
    `audio message queued in ${
      (new Date().getTime() - ctx.timeReceived.getTime()) / 1000
    }s`
  )
  return queuedJob
}

function transcriptionAccessUserId(sourceMessage: Message, ctx: Context) {
  return sourceMessage.from?.id
    ? String(sourceMessage.from.id)
    : ctx.from?.id
    ? String(ctx.from.id)
    : undefined
}

function sendTranscriptionLimitError(
  ctx: Context,
  reason: TranscriptionAbuseLimitReason,
  sourceMessage: Message
) {
  return replyAndTrackReachability(ctx, 'sendTranscriptionLimitError', {
    text: markdownI18n(ctx, transcriptionLimitMessageKey(reason)),
    options: {
      parse_mode: 'Markdown',
      reply_to_message_id: sourceMessage.message_id,
    },
  })
}

function replyAndTrackReachability(
  ctx: Context,
  location: string,
  reply: { text: string; options?: Record<string, unknown> }
) {
  return ctx.reply(reply.text, reply.options).catch(async (error) => {
    await markChatUnreachableForTelegramError(ctx, error, {
      location,
      action: 'reply',
    })
    throw error
  })
}

function sendTranscriptionAccessError(
  ctx: Context,
  reason: TranscriptionAccessDenialReason | undefined,
  sourceMessage: Message
) {
  return replyAndTrackReachability(ctx, 'sendTranscriptionAccessError', {
    text: markdownI18n(ctx, transcriptionAccessMessageKey(reason)),
    options: {
      parse_mode: 'Markdown',
      reply_to_message_id: sourceMessage.message_id,
      disable_web_page_preview: true,
    },
  })
}

function transcriptionAccessMessageKey(
  reason: TranscriptionAccessDenialReason | undefined
) {
  if (reason === TranscriptionAccessDenialReason.freeAllowanceExhausted) {
    return 'golden_borodutch_free_transcriptions_exhausted'
  }
  if (
    reason === TranscriptionAccessDenialReason.membershipCheckFailed ||
    reason === TranscriptionAccessDenialReason.missingUser
  ) {
    return 'golden_borodutch_membership_check_failed'
  }
  return 'golden_borodutch_subscription_required'
}

function sourceKind(sourceType: TranscribableTelegramFile['sourceType']) {
  if (sourceType === 'video_note') {
    return TranscriptionJobSourceKind.videoNote
  }
  return sourceType as TranscriptionJobSourceKind
}

function fileUniqueId(audio: TranscribableTelegramFile) {
  return 'file_unique_id' in audio ? audio.file_unique_id : undefined
}

async function sendSilentTranscriptionChatAction(ctx: Context) {
  if (ctx.chat.type === 'channel') {
    return
  }

  try {
    await ctx.api.sendChatAction(ctx.chat.id, 'typing')
  } catch (error) {
    await markChatUnreachableForTelegramError(ctx, error, {
      location: 'sendSilentTranscriptionChatAction',
      action: 'sendChatAction',
    })
    report(error, { ctx, location: 'sendSilentTranscriptionChatAction' })
  }
}

async function sendQueueError(ctx: Context) {
  try {
    await replyAndTrackReachability(ctx, 'sendQueueError', {
      text: markdownI18n(ctx, 'error_queue'),
      options: {
        parse_mode: 'Markdown',
        reply_to_message_id: ctx.msg?.message_id,
      },
    })
  } catch (error) {
    report(error, { ctx, location: 'sendQueueError' })
  }
}

function sendLargeFileError(ctx: Context) {
  return replyAndTrackReachability(ctx, 'sendLargeFileError', {
    text: markdownI18n(ctx, 'error_twenty'),
    options: {
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.msg.message_id,
    },
  })
}

function transcriptionLimitMessageKey(reason: TranscriptionAbuseLimitReason) {
  if (reason === TranscriptionAbuseLimitReason.chatQueueFull) {
    return 'error_transcription_queue_full'
  }
  if (reason === TranscriptionAbuseLimitReason.userRateLimited) {
    return 'error_transcription_user_limited'
  }
  return 'error_transcription_chat_limited'
}

export { enqueueTranscription, isMediaTooLarge, transcriptionAccessUserId }
