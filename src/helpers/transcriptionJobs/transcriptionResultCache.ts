import { DocumentType } from '@typegoose/typegoose'
import { Message } from '@grammyjs/types'
import {
  TranscribableTelegramFile,
  TranscribableTelegramSourceType,
} from '@/helpers/transcribableTelegramMedia'
import {
  TranscriptionJob,
  TranscriptionJobSourceKind,
  TranscriptionJobStatus,
} from '@/models/TranscriptionJob'
import {
  TranscriptionResultCache,
  TranscriptionResultCacheModel,
} from '@/models/TranscriptionResultCache'
import { answerGuestQueryWithText } from '@/helpers/telegramGuestMode'
import { splitTelegramText, transcriptText } from './transcriptFormatting'
import Context from '@/models/Context'
import localizedTranscriptionText from '@/helpers/localizedTranscriptionText'
import publishCompletedTranscriptionJob, {
  guestFinalTranscriptionText,
} from '@/helpers/transcriptionJobs/publishCompletedTranscriptionJob'

const DEFAULT_CACHE_TTL_DAYS = 10
const SECONDS_PER_DAY = 24 * 60 * 60

export function transcriptionResultCacheTtlSeconds(
  env: NodeJS.ProcessEnv = process.env
) {
  const configuredDays = Number(env.VOICY_TRANSCRIPTION_CACHE_TTL_DAYS)
  const days =
    Number.isFinite(configuredDays) && configuredDays > 0
      ? configuredDays
      : DEFAULT_CACHE_TTL_DAYS
  return Math.round(days * SECONDS_PER_DAY)
}

export function transcriptionResultCacheExpiresAt(
  from = new Date(),
  env: NodeJS.ProcessEnv = process.env
) {
  return new Date(
    from.getTime() + transcriptionResultCacheTtlSeconds(env) * 1000
  )
}

export function sourceKindFromTelegramSourceType(
  sourceType: TranscribableTelegramSourceType
) {
  if (sourceType === 'video_note') {
    return TranscriptionJobSourceKind.videoNote
  }
  return sourceType as TranscriptionJobSourceKind
}

export function transcriptionResultCacheKey(
  media: Pick<
    TranscribableTelegramFile,
    'file_id' | 'file_unique_id' | 'sourceType'
  >
) {
  if (media.file_unique_id) {
    return `telegram:file_unique_id:${media.file_unique_id}`
  }
  return `telegram:${media.sourceType}:file_id:${media.file_id}`
}

function transcriptionResultCacheKeyFromJob(job: TranscriptionJob) {
  if (job.fileUniqueId) {
    return `telegram:file_unique_id:${job.fileUniqueId}`
  }
  return `telegram:${job.sourceKind}:file_id:${job.fileId}`
}

export async function cacheCompletedTranscriptionJob(
  job: DocumentType<TranscriptionJob>
) {
  const cacheKey = transcriptionResultCacheKeyFromJob(job)
  await TranscriptionResultCacheModel.findOneAndUpdate(
    { cacheKey },
    {
      $set: {
        cacheKey,
        fileUniqueId: job.fileUniqueId,
        sourceKind: job.sourceKind,
        resultText: job.resultText,
        resultParts: job.resultParts,
        recognitionLanguage: job.recognitionLanguage,
        workerEngine: job.workerEngine,
        workerEngineMetadata: job.workerEngineMetadata,
        duration: job.duration,
        completedAt: job.completedAt || new Date(),
        expiresAt: transcriptionResultCacheExpiresAt(),
      },
    },
    { upsert: true, new: true }
  )
}

export function cachedTranscriptionResult(media: TranscribableTelegramFile) {
  return TranscriptionResultCacheModel.findOne({
    cacheKey: transcriptionResultCacheKey(media),
    expiresAt: { $gt: new Date() },
  })
}

export async function publishCachedTranscriptionResult({
  ctx,
  media,
  sourceMessage,
  guestQueryId,
}: {
  ctx: Context
  media: TranscribableTelegramFile
  sourceMessage: Message
  guestQueryId?: string
}) {
  const cached = await cachedTranscriptionResult(media)
  if (!cached) {
    return false
  }

  const job = cachedReplayJob(ctx, media, sourceMessage, cached)
  if (guestQueryId) {
    const finalText = transcriptText(job, {
      includeTimecodes: !job.silent,
    }).trim()
    const chunks = splitTelegramText(finalText) || ['']
    const firstText =
      chunks.shift() ||
      localizedTranscriptionText(ctx.dbchat.uiLanguage, 'completed_empty')
    job.guestInlineMessageId = await answerGuestQueryWithText(
      ctx,
      guestQueryId,
      guestFinalTranscriptionText(job, firstText, chunks.length)
    )
  }

  await publishCompletedTranscriptionJob(job)
  return true
}

function cachedReplayJob(
  ctx: Context,
  media: TranscribableTelegramFile,
  sourceMessage: Message,
  cached: DocumentType<TranscriptionResultCache>
) {
  return {
    status: TranscriptionJobStatus.completed,
    chatId: ctx.dbchat.id,
    telegramChatId: String(ctx.chat.id),
    telegramChatType: ctx.chat.type,
    sourceMessageId: sourceMessage.message_id,
    requestMessageId: ctx.msg?.message_id,
    silent: ctx.dbchat.silent,
    fileId: media.file_id,
    fileUniqueId: media.file_unique_id,
    fileSize: media.file_size,
    mimeType: media.mime_type,
    fileName: media.file_name,
    sourceKind: sourceKindFromTelegramSourceType(media.sourceType),
    requestedByUserId: ctx.from?.id ? String(ctx.from.id) : undefined,
    forwardedFromUserId: sourceMessage.forward_from?.id
      ? String(sourceMessage.forward_from.id)
      : undefined,
    forwardedSenderName: sourceMessage.forward_sender_name,
    uiLocale: ctx.dbchat.uiLanguage,
    resultText: cached.resultText,
    resultParts: cached.resultParts,
    recognitionLanguage: cached.recognitionLanguage,
    workerEngine: cached.workerEngine,
    workerEngineMetadata: cached.workerEngineMetadata,
    duration: cached.duration,
    completedAt: cached.completedAt || new Date(),
  } as DocumentType<TranscriptionJob>
}
