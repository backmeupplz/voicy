#!/usr/bin/env node

require('module-alias/register')

const {
  isTranscribableMimeType,
  transcribableExtension,
  transcribableMediaFromMessage,
} = require('../dist/helpers/transcribableTelegramMedia')
const { extensionForSource } = require('../dist/workerClient/runWindowsWorker')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function assertMedia(message, sourceType, fileId) {
  const media = transcribableMediaFromMessage(message)
  assert(media, `${sourceType} should be transcribable`)
  assert(media.sourceType === sourceType, `${sourceType} source type missing`)
  assert(media.file_id === fileId, `${sourceType} file id missing`)
}

assert(isTranscribableMimeType('audio/flac'), 'FLAC MIME should be accepted')
assert(
  isTranscribableMimeType('video/mp4'),
  'MP4 video MIME should be accepted'
)
assert(
  isTranscribableMimeType('application/ogg'),
  'application/ogg MIME should be accepted'
)
assert(
  transcribableExtension('meeting-recording.m4a') === '.m4a',
  'M4A extension should be accepted'
)
assert(!transcribableExtension('notes.pdf'), 'PDF extension should be rejected')

assertMedia(
  {
    audio: { file_id: 'audio-file', mime_type: 'audio/mpeg' },
  },
  'audio',
  'audio-file'
)
assertMedia(
  {
    video: { file_id: 'video-file', mime_type: 'video/mp4' },
  },
  'video',
  'video-file'
)
assertMedia(
  {
    document: {
      file_id: 'doc-file',
      file_name: 'call-recording.opus',
      mime_type: 'application/octet-stream',
    },
  },
  'document',
  'doc-file'
)
assert(
  !transcribableMediaFromMessage({
    document: {
      file_id: 'pdf-file',
      file_name: 'contract.pdf',
      mime_type: 'application/pdf',
    },
  }),
  'PDF documents should not be transcribable'
)
assert(
  !transcribableMediaFromMessage({
    document: {
      file_id: 'octet-pdf-file',
      file_name: 'contract.pdf',
      mime_type: 'application/octet-stream',
    },
  }),
  'octet-stream documents with unsupported extensions should not be transcribable'
)
assert(
  !transcribableMediaFromMessage({
    document: {
      file_id: 'anonymous-octet-file',
      mime_type: 'application/octet-stream',
    },
  }),
  'anonymous octet-stream documents should not be transcribable'
)
assert(
  !transcribableMediaFromMessage({
    document: {
      file_id: 'missing-mime-file',
      file_name: 'upload',
    },
  }),
  'documents without MIME or supported extension should not be transcribable'
)
assertMedia(
  {
    document: {
      file_id: 'missing-mime-audio-file',
      file_name: 'meeting.wav',
    },
  },
  'document',
  'missing-mime-audio-file'
)

assert(
  extensionForSource({
    sourceUrl: 'https://example.invalid/file',
    mimeType: 'audio/flac',
  }) === '.flac',
  'worker should preserve FLAC extension from MIME'
)
assert(
  extensionForSource({
    sourceUrl: 'https://example.invalid/file',
    mimeType: 'application/octet-stream',
    fileName: 'telegram-upload.webm',
  }) === '.webm',
  'worker should preserve extension from Telegram file name'
)
assert(
  extensionForSource({
    sourceUrl: 'https://example.invalid/file',
    sourceKind: 'video',
  }) === '.mp4',
  'worker should default video sources to mp4'
)

console.log('media coverage proof passed')
