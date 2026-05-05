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
  TranscriptionJobModel,
  TranscriptionJobSourceKind,
  TranscriptionJobStatus,
} from '@/models/TranscriptionJob'
import { isTranscriptionAllowedByDonationWall } from '@/helpers/donationWall'
import { markdownI18n } from '@/helpers/telegramMarkdown'
import { transcriptionProgressStatusHtml } from '@/helpers/transcriptionJobs/progressStatusText'
import Context from '@/models/Context'
import report from '@/helpers/report'

export default async function handleAudio(ctx: Context) {
  try {
    if (!isTranscriptionAllowedByDonationWall(ctx.dbchat)) {
      console.log('Sending the donate message')
      await ctx.reply(markdownI18n(ctx, 'sunsetting'), {
        parse_mode: 'Markdown',
        reply_to_message_id: ctx.msg.message_id,
        disable_web_page_preview: true,
      })
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
    await sendQueueError(ctx)
  }
}

function sendLargeFileError(ctx: Context) {
  return ctx.reply(markdownI18n(ctx, 'error_twenty'), {
    parse_mode: 'Markdown',
    reply_to_message_id: ctx.msg.message_id,
  })
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
  const audio = transcribableMediaFromMessage(sourceMessage)
  if (!audio) {
    throw new Error('No supported audio payload found on message')
  }
  const abuseLimit = await checkTranscriptionAbuseLimits({
    chatId: ctx.dbchat.id,
    userId: ctx.from?.id ? String(ctx.from.id) : undefined,
  })
  if (abuseLimit) {
    await sendTranscriptionLimitError(ctx, abuseLimit.reason, sourceMessage)
    return undefined
  }

  const queuedJob = await TranscriptionJobModel.create({
    status: TranscriptionJobStatus.queuedForDownload,
    chatId: ctx.dbchat.id,
    telegramChatId: String(ctx.chat.id),
    telegramChatType: ctx.chat.type,
    sourceMessageId: sourceMessage.message_id,
    requestMessageId: ctx.msg?.message_id,
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
    report(error, { ctx, location: 'ackQueuedTranscription' })
  }

  console.info(
    `audio message queued in ${
      (new Date().getTime() - ctx.timeReceived.getTime()) / 1000
    }s`
  )
  return queuedJob
}

function sendTranscriptionLimitError(
  ctx: Context,
  reason: TranscriptionAbuseLimitReason,
  sourceMessage: Message
) {
  return ctx.reply(markdownI18n(ctx, transcriptionLimitMessageKey(reason)), {
    parse_mode: 'Markdown',
    reply_to_message_id: sourceMessage.message_id,
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

function sourceKind(sourceType: TranscribableTelegramFile['sourceType']) {
  if (sourceType === 'video_note') {
    return TranscriptionJobSourceKind.videoNote
  }
  return sourceType as TranscriptionJobSourceKind
}

function fileUniqueId(audio: TranscribableTelegramFile) {
  return 'file_unique_id' in audio ? audio.file_unique_id : undefined
}

async function sendQueueError(ctx: Context) {
  try {
    await ctx.reply(markdownI18n(ctx, 'error_queue'), {
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.msg?.message_id,
    })
  } catch (error) {
    report(error, { ctx, location: 'sendQueueError' })
  }
}

export { enqueueTranscription, isMediaTooLarge }
