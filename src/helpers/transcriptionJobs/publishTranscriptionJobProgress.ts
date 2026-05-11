import { DocumentType } from '@typegoose/typegoose'
import {
  TelegramReachabilityFailureKind,
  classifyTelegramReachabilityFailure,
  markChatUnreachableByIdForTelegramError,
} from '@/helpers/chatReachability'
import {
  TranscriptionJob,
  TranscriptionJobModel,
} from '@/models/TranscriptionJob'
import { Types } from 'mongoose'
import { guestInlineMessageIdsFromJob } from '@/helpers/telegramGuestMode'
import {
  liveProgressAllowedForChatType,
  shouldThrottleProgressPublish,
} from '@/helpers/transcriptionJobs/progressPublishingPolicy'
import { partialTranscriptText } from '@/helpers/transcriptionJobs/transcriptFormatting'
import {
  silentTranscriptionProgressPreviewHtml,
  transcriptionProgressPreviewHtml,
  transcriptionProgressStatusHtml,
} from '@/helpers/transcriptionJobs/progressStatusText'
import bot from '@/helpers/bot'

type ProgressPhase = 'processing' | 'partial' | 'retrying' | 'failed'

const SILENT_STATUS_MESSAGE_PUBLISHING_LEASE_MS = 30_000

function statusTextHtml(
  phase: ProgressPhase,
  job: DocumentType<TranscriptionJob>
) {
  if (phase === 'processing') {
    return transcriptionProgressStatusHtml(job.uiLocale, 'progress_processing')
  }
  if (phase === 'retrying') {
    return transcriptionProgressStatusHtml(job.uiLocale, 'progress_retrying')
  }
  if (phase === 'failed') {
    return transcriptionProgressStatusHtml(job.uiLocale, 'progress_failed')
  }
  const partialText = partialTranscriptText(job, { includeTimecodes: false })
  return partialText
    ? transcriptionProgressPreviewHtml(job.uiLocale, partialText)
    : transcriptionProgressStatusHtml(job.uiLocale, 'progress_partial')
}

function persistedJobId(job: DocumentType<TranscriptionJob>) {
  const id = (job as { _id?: unknown })._id
  return id instanceof Types.ObjectId || typeof id === 'string' ? id : undefined
}

async function claimSilentStatusMessagePublish(
  job: DocumentType<TranscriptionJob>
) {
  const id = persistedJobId(job)
  if (!id || job.statusMessageId) {
    return true
  }

  const now = new Date()
  const staleBefore = new Date(
    now.getTime() - SILENT_STATUS_MESSAGE_PUBLISHING_LEASE_MS
  )
  const claimedJob = await TranscriptionJobModel.findOneAndUpdate(
    {
      _id: id,
      silent: true,
      $and: [
        {
          $or: [
            { statusMessageId: { $exists: false } },
            { statusMessageId: null },
          ],
        },
        {
          $or: [
            { statusMessagePublishingAt: { $exists: false } },
            { statusMessagePublishingAt: null },
            { statusMessagePublishingAt: { $lt: staleBefore } },
          ],
        },
      ],
    },
    { $set: { statusMessagePublishingAt: now } },
    { new: true }
  )

  return Boolean(claimedJob)
}

async function persistSilentStatusMessage(
  job: DocumentType<TranscriptionJob>,
  statusMessageId: number
) {
  const now = new Date()
  job.statusMessageId = statusMessageId
  job.lastProgressPublishedAt = now
  job.statusMessagePublishingAt = undefined

  const id = persistedJobId(job)
  if (!id) {
    await job.save()
    return
  }

  await TranscriptionJobModel.updateOne(
    { _id: id },
    {
      $set: { statusMessageId, lastProgressPublishedAt: now },
      $unset: { statusMessagePublishingAt: '' },
    }
  )
}

async function releaseSilentStatusMessagePublish(
  job: DocumentType<TranscriptionJob>
) {
  const id = persistedJobId(job)
  if (!id || job.statusMessageId) {
    return
  }

  job.statusMessagePublishingAt = undefined
  await TranscriptionJobModel.updateOne(
    {
      _id: id,
      $or: [{ statusMessageId: { $exists: false } }, { statusMessageId: null }],
    },
    { $unset: { statusMessagePublishingAt: '' } }
  )
}

export default async function publishTranscriptionJobProgress(
  job: DocumentType<TranscriptionJob>,
  phase: ProgressPhase,
  { force = false }: { force?: boolean } = {}
) {
  if (
    process.env.VOICY_DISABLE_TELEGRAM_PUBLISH === '1' ||
    !liveProgressAllowedForChatType(job.telegramChatType) ||
    shouldThrottleProgressPublish({
      force,
      lastPublishedAt: job.lastProgressPublishedAt,
    })
  ) {
    return false
  }

  const guestInlineMessageIds = guestInlineMessageIdsFromJob(job)
  if (guestInlineMessageIds.length > 0) {
    const text = statusTextHtml(phase, job)
    let edited = false
    for (const guestInlineMessageId of guestInlineMessageIds) {
      try {
        await bot.api.editMessageTextInline(guestInlineMessageId, text, {
          parse_mode: 'HTML',
        })
        edited = true
      } catch (error) {
        const failure = classifyTelegramReachabilityFailure(error)
        if (
          failure.kind === TelegramReachabilityFailureKind.benign ||
          failure.kind === TelegramReachabilityFailureKind.staleStatusMessage
        ) {
          continue
        }
        throw error
      }
    }

    if (!edited) {
      return false
    }

    if (phase === 'partial') {
      job.lastProgressPublishedAt = new Date()
      await job.save()
    }

    return true
  }

  if (job.silent) {
    if (phase !== 'partial') {
      return false
    }

    const text = silentTranscriptionProgressPreviewHtml(
      partialTranscriptText(job, { includeTimecodes: false })
    )
    if (!text) {
      return false
    }

    const claimedStatusMessagePublish = await claimSilentStatusMessagePublish(
      job
    )
    if (!claimedStatusMessagePublish) {
      return false
    }

    let persistedStatusMessage = false
    try {
      if (job.statusMessageId) {
        await bot.api.editMessageText(
          job.telegramChatId,
          job.statusMessageId,
          text,
          { parse_mode: 'HTML' }
        )
      } else {
        const message = await bot.api.sendMessage(job.telegramChatId, text, {
          parse_mode: 'HTML',
          reply_to_message_id: job.sourceMessageId,
        })
        await persistSilentStatusMessage(job, message.message_id)
        persistedStatusMessage = true
      }
    } catch (error) {
      await releaseSilentStatusMessagePublish(job)
      const description =
        error && typeof error === 'object' && 'description' in error
          ? String((error as { description?: string }).description)
          : ''
      if (!description.includes('message is not modified')) {
        throw error
      }
    }

    if (job.statusMessageId && !persistedStatusMessage) {
      job.lastProgressPublishedAt = new Date()
      await job.save()
    }
    return true
  }

  if (!job.statusMessageId) {
    return false
  }

  try {
    await bot.api.editMessageText(
      job.telegramChatId,
      job.statusMessageId,
      statusTextHtml(phase, job),
      { parse_mode: 'HTML' }
    )
  } catch (error) {
    const failure = classifyTelegramReachabilityFailure(error)
    if (failure.kind === TelegramReachabilityFailureKind.benign) {
      return false
    }
    if (failure.kind === TelegramReachabilityFailureKind.staleStatusMessage) {
      console.warn(
        `Skipping stale transcription progress message for chat ${job.chatId}`
      )
      return false
    }
    await markChatUnreachableByIdForTelegramError(job.chatId, error, {
      location: 'publishTranscriptionJobProgress',
      action: 'editMessageText',
    })
    throw error
  }

  if (phase === 'partial') {
    job.lastProgressPublishedAt = new Date()
    await job.save()
  }

  return true
}

export { statusTextHtml }
