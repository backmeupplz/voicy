import { TELEGRAM_MESSAGE_LIMIT } from '@/helpers/transcriptionJobs/transcriptFormatting'
import localizedTranscriptionText from '@/helpers/localizedTranscriptionText'

export const TRANSCRIPTION_PROGRESS_EMOJIS = ['🪄', '✨', '🎧', '📝', '🔮']

export type TranscriptionProgressTextKey =
  | 'progress_processing'
  | 'progress_retrying'
  | 'progress_failed'
  | 'progress_partial'

type RandomSource = () => number

function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function pickTranscriptionProgressEmoji(
  random: RandomSource = Math.random
) {
  const value = random()
  const normalized = Number.isFinite(value) ? Math.max(0, value) : 0
  const index = Math.min(
    TRANSCRIPTION_PROGRESS_EMOJIS.length - 1,
    Math.floor(normalized * TRANSCRIPTION_PROGRESS_EMOJIS.length)
  )
  return TRANSCRIPTION_PROGRESS_EMOJIS[index]
}

export function transcriptionProgressStatusLine(
  locale: string | undefined,
  key: TranscriptionProgressTextKey,
  random: RandomSource = Math.random
) {
  return `${pickTranscriptionProgressEmoji(
    random
  )} ${localizedTranscriptionText(locale, key)}`
}

export function transcriptionProgressStatusHtml(
  locale: string | undefined,
  key: TranscriptionProgressTextKey,
  random: RandomSource = Math.random
) {
  return `<i>${escapeHtml(
    transcriptionProgressStatusLine(locale, key, random)
  )}</i>`
}

export function transcriptionProgressPreviewHtml(
  locale: string | undefined,
  partialText: string,
  random: RandomSource = Math.random
) {
  const header = transcriptionProgressStatusLine(
    locale,
    'progress_partial',
    random
  )
  const footer = localizedTranscriptionText(locale, 'progress_partial_footer')
  const reserved = header.length + footer.length + 8
  const limit = TELEGRAM_MESSAGE_LIMIT - reserved
  const normalized = partialText.trim()
  const preview =
    normalized.length > limit
      ? `${normalized.slice(0, limit - 3)}...`
      : normalized

  return `<i>${escapeHtml(header)}</i>\n\n${escapeHtml(
    preview
  )}\n\n${escapeHtml(footer)}`
}

export function silentTranscriptionProgressPreviewHtml(partialText: string) {
  const normalized = partialText.trim()
  if (!normalized) {
    return ''
  }
  const preview =
    normalized.length > TELEGRAM_MESSAGE_LIMIT
      ? `${normalized.slice(0, TELEGRAM_MESSAGE_LIMIT - 3)}...`
      : normalized
  return escapeHtml(preview)
}
