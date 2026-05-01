import { DocumentType } from '@typegoose/typegoose'
import { TranscriptionJob } from '@/models/TranscriptionJob'
import {
  partialTranscriptText,
  progressPreview,
} from '@/helpers/transcriptionJobs/transcriptFormatting'
import bot from '@/helpers/bot'
import localizedTranscriptionText from '@/helpers/localizedTranscriptionText'

const DEFAULT_PROGRESS_EDIT_INTERVAL_MS = 2500

type ProgressPhase = 'processing' | 'partial' | 'retrying' | 'failed'

function progressEditIntervalMs() {
  const configured = Number(process.env.VOICY_PROGRESS_EDIT_INTERVAL_MS)
  return Number.isFinite(configured) && configured >= 1000
    ? configured
    : DEFAULT_PROGRESS_EDIT_INTERVAL_MS
}

function shouldThrottle(job: DocumentType<TranscriptionJob>, force: boolean) {
  if (force || !job.lastProgressPublishedAt) {
    return false
  }
  return (
    new Date().getTime() - job.lastProgressPublishedAt.getTime() <
    progressEditIntervalMs()
  )
}

function statusText(phase: ProgressPhase, job: DocumentType<TranscriptionJob>) {
  if (phase === 'processing') {
    return localizedTranscriptionText(job.uiLocale, 'progress_processing')
  }
  if (phase === 'retrying') {
    return localizedTranscriptionText(job.uiLocale, 'progress_retrying')
  }
  if (phase === 'failed') {
    return localizedTranscriptionText(job.uiLocale, 'progress_failed')
  }
  const partialText = partialTranscriptText(job)
  return partialText
    ? progressPreview(partialText, {
        header: localizedTranscriptionText(job.uiLocale, 'progress_partial'),
        footer: localizedTranscriptionText(
          job.uiLocale,
          'progress_partial_footer'
        ),
      })
    : localizedTranscriptionText(job.uiLocale, 'progress_partial')
}

export default async function publishTranscriptionJobProgress(
  job: DocumentType<TranscriptionJob>,
  phase: ProgressPhase,
  { force = false }: { force?: boolean } = {}
) {
  if (
    process.env.VOICY_DISABLE_TELEGRAM_PUBLISH === '1' ||
    !job.statusMessageId ||
    shouldThrottle(job, force)
  ) {
    return false
  }

  try {
    await bot.api.editMessageText(
      job.telegramChatId,
      job.statusMessageId,
      statusText(phase, job)
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
