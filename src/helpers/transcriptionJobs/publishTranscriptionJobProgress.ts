import { DocumentType } from '@typegoose/typegoose'
import { TranscriptionJob } from '@/models/TranscriptionJob'
import {
  liveProgressAllowedForChatType,
  shouldThrottleProgressPublish,
} from '@/helpers/transcriptionJobs/progressPublishingPolicy'
import { partialTranscriptText } from '@/helpers/transcriptionJobs/transcriptFormatting'
import {
  transcriptionProgressPreviewHtml,
  transcriptionProgressStatusHtml,
} from '@/helpers/transcriptionJobs/progressStatusText'
import bot from '@/helpers/bot'

type ProgressPhase = 'processing' | 'partial' | 'retrying' | 'failed'

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
  const partialText = partialTranscriptText(job)
  return partialText
    ? transcriptionProgressPreviewHtml(job.uiLocale, partialText)
    : transcriptionProgressStatusHtml(job.uiLocale, 'progress_partial')
}

export default async function publishTranscriptionJobProgress(
  job: DocumentType<TranscriptionJob>,
  phase: ProgressPhase,
  { force = false }: { force?: boolean } = {}
) {
  if (
    process.env.VOICY_DISABLE_TELEGRAM_PUBLISH === '1' ||
    !job.statusMessageId ||
    !liveProgressAllowedForChatType(job.telegramChatType) ||
    shouldThrottleProgressPublish({
      force,
      lastPublishedAt: job.lastProgressPublishedAt,
    })
  ) {
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
    const description =
      error && typeof error === 'object' && 'description' in error
        ? String((error as { description?: string }).description)
        : ''
    if (!description.includes('message is not modified')) {
      throw error
    }
  }

  if (phase === 'partial') {
    job.lastProgressPublishedAt = new Date()
    await job.save()
  }

  return true
}

export { statusTextHtml }
