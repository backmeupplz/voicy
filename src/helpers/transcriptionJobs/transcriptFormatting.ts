import { DocumentType } from '@typegoose/typegoose'
import {
  TranscriptionJob,
  TranscriptionResultPart,
} from '@/models/TranscriptionJob'

export const TELEGRAM_MESSAGE_LIMIT = 4000

const PROGRESS_HEADER = 'Transcribing...'
const PROGRESS_FOOTER = 'Partial transcript; final text may still change.'

export function splitTelegramText(text: string) {
  return text.match(new RegExp(`[\\s\\S]{1,${TELEGRAM_MESSAGE_LIMIT}}`, 'g'))
}

export function transcriptTextFromParts(
  parts?: TranscriptionResultPart[],
  fallback = ''
) {
  if (parts?.length) {
    return parts
      .map((part) =>
        part.timeCode ? `${part.timeCode}:\n${part.text}` : part.text
      )
      .join('\n')
  }
  return fallback
}

export function transcriptText(job: DocumentType<TranscriptionJob>) {
  return transcriptTextFromParts(job.resultParts, job.resultText || '')
}

export function partialTranscriptText(job: DocumentType<TranscriptionJob>) {
  return transcriptTextFromParts(
    job.partialResultParts,
    job.partialResultText || job.resultText || ''
  )
}

export function progressPreview(text: string) {
  const reserved = PROGRESS_HEADER.length + PROGRESS_FOOTER.length + 8
  const limit = TELEGRAM_MESSAGE_LIMIT - reserved
  const normalized = text.trim()
  const preview =
    normalized.length > limit
      ? `${normalized.slice(0, limit - 3)}...`
      : normalized
  return `${PROGRESS_HEADER}\n\n${preview}\n\n${PROGRESS_FOOTER}`
}
