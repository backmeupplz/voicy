import { DocumentType } from '@typegoose/typegoose'
import { TranscriptionJob } from '@/models/TranscriptionJob'
import { VoiceModel } from '@/models/Voice'
import {
  splitTelegramText,
  transcriptText,
} from '@/helpers/transcriptionJobs/transcriptFormatting'
import bot from '@/helpers/bot'
import localizedTranscriptionText from '@/helpers/localizedTranscriptionText'

async function storeVoiceRecord(job: DocumentType<TranscriptionJob>) {
  await VoiceModel.create({
    url: job.sourceUrl || job.localSourcePath || job.filePath || job.fileId,
    status: 'completed',
    chatId: job.chatId,
    messageId: job.sourceMessageId,
    ackMessageId: job.statusMessageId,
    fileId: job.fileId,
    fileSize: job.fileSize,
    mimeType: job.mimeType,
    fileName: job.fileName,
    sourceType: job.sourceKind,
    requestedBy: job.requestedByUserId
      ? Number(job.requestedByUserId)
      : undefined,
    forwardFromId: job.forwardedFromUserId
      ? Number(job.forwardedFromUserId)
      : undefined,
    forwardSenderName: job.forwardedSenderName,
    claimedAt: job.claimedAt,
    completedAt: job.completedAt || new Date(),
    duration: job.duration || 0,
    language: job.recognitionLanguage || job.recognitionLanguageHint || 'auto',
    text: job.resultText || transcriptText(job),
    textWithTimecodes: job.resultParts?.map((part) => [
      part.timeCode || '',
      part.text,
    ]),
    workerEngine: job.workerEngine,
  })
}

export default async function publishCompletedTranscriptionJob(
  job: DocumentType<TranscriptionJob>
) {
  await storeVoiceRecord(job)

  if (process.env.VOICY_DISABLE_TELEGRAM_PUBLISH === '1') {
    return
  }

  const chunks = splitTelegramText(transcriptText(job).trim()) || ['']
  const firstText = chunks.shift() || ''
  const fallbackText = localizedTranscriptionText(
    job.uiLocale,
    'completed_empty'
  )
  const replyOptions =
    job.telegramChatType === 'channel'
      ? {}
      : { reply_to_message_id: job.sourceMessageId }

  if (job.statusMessageId) {
    await bot.api.editMessageText(
      job.telegramChatId,
      job.statusMessageId,
      firstText || fallbackText
    )
  } else {
    await bot.api.sendMessage(job.telegramChatId, firstText || fallbackText, {
      ...replyOptions,
    })
  }

  for (const chunk of chunks) {
    await bot.api.sendMessage(job.telegramChatId, chunk, {
      ...replyOptions,
    })
  }
}
