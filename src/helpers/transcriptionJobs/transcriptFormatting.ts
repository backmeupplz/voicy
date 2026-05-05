import { DocumentType } from '@typegoose/typegoose'
import {
  TranscriptionJob,
  TranscriptionResultPart,
} from '@/models/TranscriptionJob'

export const TELEGRAM_MESSAGE_LIMIT = 4000

type ProgressPreviewOptions = {
  header?: string
  footer?: string
}

type StructuredTranscriptResult = {
  text?: unknown
  parts?: unknown
}

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

function parseStructuredTranscriptResult(
  resultText?: string
): StructuredTranscriptResult | undefined {
  const trimmed = resultText?.trim()
  if (!trimmed || !trimmed.startsWith('{')) {
    return undefined
  }

  try {
    const parsed = JSON.parse(trimmed)
    return parsed && typeof parsed === 'object'
      ? (parsed as StructuredTranscriptResult)
      : undefined
  } catch {
    return undefined
  }
}

function structuredTranscriptParts(parts: unknown) {
  if (!Array.isArray(parts)) {
    return undefined
  }

  return parts
    .map((part) => {
      if (!part || typeof part !== 'object') {
        return undefined
      }
      const { timeCode, text } = part as Partial<TranscriptionResultPart>
      return typeof text === 'string' &&
        (timeCode === undefined || typeof timeCode === 'string')
        ? { timeCode, text }
        : undefined
    })
    .filter(Boolean) as TranscriptionResultPart[]
}

export function transcriptText(job: DocumentType<TranscriptionJob>) {
  const structured = parseStructuredTranscriptResult(job.resultText)
  if (structured) {
    const partsText = transcriptTextFromParts(
      structuredTranscriptParts(structured.parts)
    )
    if (partsText) {
      return partsText
    }
    return typeof structured.text === 'string' ? structured.text.trim() : ''
  }

  return (
    job.resultText?.trim() || transcriptTextFromParts(job.resultParts) || ''
  )
}

export function partialTranscriptText(job: DocumentType<TranscriptionJob>) {
  return transcriptTextFromParts(
    job.partialResultParts,
    job.partialResultText || job.resultText || ''
  )
}

export function progressPreview(
  text: string,
  {
    header = 'Turning into text...',
    footer = 'Draft text; final text may still change.',
  }: ProgressPreviewOptions = {}
) {
  const reserved = header.length + footer.length + 8
  const limit = TELEGRAM_MESSAGE_LIMIT - reserved
  const normalized = text.trim()
  const preview =
    normalized.length > limit
      ? `${normalized.slice(0, limit - 3)}...`
      : normalized
  return `${header}\n\n${preview}\n\n${footer}`
}
