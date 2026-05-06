import { DocumentType } from '@typegoose/typegoose'
import {
  TranscriptionJob,
  TranscriptionResultPart,
} from '@/models/TranscriptionJob'

export const TELEGRAM_MESSAGE_LIMIT = 4000

type StructuredTranscriptResult = {
  text?: unknown
  parts?: unknown
}

type TranscriptTextOptions = {
  includeTimecodes?: boolean
}

export function splitTelegramText(text: string) {
  return text.match(new RegExp(`[\\s\\S]{1,${TELEGRAM_MESSAGE_LIMIT}}`, 'g'))
}

function plainTranscriptText(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

export function transcriptTextFromParts(
  parts?: TranscriptionResultPart[],
  fallback = '',
  { includeTimecodes = true }: TranscriptTextOptions = {}
) {
  if (parts?.length) {
    if (!includeTimecodes) {
      return parts
        .map((part) => plainTranscriptText(part.text))
        .filter(Boolean)
        .join(' ')
    }

    return parts
      .map((part) =>
        part.timeCode ? `${part.timeCode}:\n${part.text}` : part.text
      )
      .join('\n')
  }
  return includeTimecodes ? fallback : plainTranscriptText(fallback)
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

export function transcriptText(
  job: DocumentType<TranscriptionJob>,
  options: TranscriptTextOptions = {}
) {
  const structured = parseStructuredTranscriptResult(job.resultText)
  if (structured) {
    const partsText = transcriptTextFromParts(
      structuredTranscriptParts(structured.parts),
      '',
      options
    )
    if (partsText) {
      return partsText
    }
    if (typeof structured.text !== 'string') {
      return ''
    }
    return options.includeTimecodes === false
      ? plainTranscriptText(structured.text)
      : structured.text.trim()
  }

  const partsText = transcriptTextFromParts(job.resultParts, '', options)
  if (options.includeTimecodes === false && partsText) {
    return partsText
  }

  if (!job.resultText) {
    return partsText || ''
  }

  return options.includeTimecodes === false
    ? plainTranscriptText(job.resultText)
    : job.resultText.trim() || partsText || ''
}

export function partialTranscriptText(
  job: DocumentType<TranscriptionJob>,
  options: TranscriptTextOptions = {}
) {
  return transcriptTextFromParts(
    job.partialResultParts,
    job.partialResultText || job.resultText || '',
    options
  )
}
