import { Message } from '@grammyjs/types'

export type TranscribableTelegramSourceType =
  | 'voice'
  | 'audio'
  | 'document'
  | 'video_note'
  | 'video'

export type TranscribableTelegramFile = {
  file_id: string
  file_size?: number
  mime_type?: string
  file_name?: string
  file_unique_id?: string
  sourceType: TranscribableTelegramSourceType
}

const transcribableMimeTypes = new Set([
  'application/mp4',
  'application/ogg',
  'application/x-mpegurl',
  'application/x-ogg',
  'application/vnd.apple.mpegurl',
])

const transcribableExtensions = new Set([
  '.3gp',
  '.3gpp',
  '.aac',
  '.aif',
  '.aifc',
  '.aiff',
  '.amr',
  '.avi',
  '.flac',
  '.m4a',
  '.m4b',
  '.m4v',
  '.mka',
  '.mkv',
  '.mov',
  '.mp3',
  '.mp4',
  '.mpeg',
  '.mpg',
  '.oga',
  '.ogg',
  '.opus',
  '.wav',
  '.wave',
  '.weba',
  '.webm',
  '.wma',
])

export function isTranscribableMimeType(mimeType?: string) {
  const normalizedMimeType = mimeType?.toLowerCase().split(';')[0].trim()
  if (!normalizedMimeType) {
    return false
  }
  return (
    normalizedMimeType.startsWith('audio/') ||
    normalizedMimeType.startsWith('video/') ||
    transcribableMimeTypes.has(normalizedMimeType)
  )
}

export function transcribableExtension(fileName?: string) {
  const match = fileName?.toLowerCase().match(/\.[a-z0-9]+$/)
  if (!match) {
    return undefined
  }
  return transcribableExtensions.has(match[0]) ? match[0] : undefined
}

export function isTranscribableTelegramFile(file: TranscribableTelegramFile) {
  if (file.sourceType !== 'document') {
    return true
  }
  if (transcribableExtension(file.file_name)) {
    return true
  }
  if (
    file.mime_type?.toLowerCase().split(';')[0].trim() ===
    'application/octet-stream'
  ) {
    return !file.file_name
  }
  return isTranscribableMimeType(file.mime_type)
}

export function transcribableMediaFromMessage(
  message: Message
): TranscribableTelegramFile | undefined {
  if (message.voice) {
    return { ...message.voice, sourceType: 'voice' }
  }
  if (message.audio) {
    return { ...message.audio, sourceType: 'audio' }
  }
  if (message.video_note) {
    return { ...message.video_note, sourceType: 'video_note' }
  }
  if (message.video) {
    return { ...message.video, sourceType: 'video' }
  }
  if (message.document) {
    const document = { ...message.document, sourceType: 'document' as const }
    return isTranscribableTelegramFile(document) ? document : undefined
  }
  return undefined
}
