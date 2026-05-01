import { DocumentType } from '@typegoose/typegoose'
import { TranscriptionJob } from '@/models/TranscriptionJob'
import { VoiceModel } from '@/models/Voice'
import bot from '@/helpers/bot'

const TELEGRAM_MESSAGE_LIMIT = 4000

function splitText(text: string) {
  return text.match(new RegExp(`[\\s\\S]{1,${TELEGRAM_MESSAGE_LIMIT}}`, 'g'))
}

function transcriptText(job: DocumentType<TranscriptionJob>) {
  if (job.resultParts?.length) {
    return job.resultParts
      .map((part) =>
        part.timeCode ? `${part.timeCode}:\n${part.text}` : part.text
      )
      .join('\n')
  }
  return job.resultText || ''
}

async function storeVoiceRecord(job: DocumentType<TranscriptionJob>) {
  await VoiceModel.create({
    url: job.sourceUrl,
    status: 'completed',
    chatId: job.chatId,
    messageId: job.sourceMessageId,
    ackMessageId: job.statusMessageId,
    fileId: job.fileId,
    fileSize: job.fileSize,
    mimeType: job.mimeType,
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

  const chunks = splitText(transcriptText(job).trim()) || ['']
  const firstText = chunks.shift() || ''
  if (job.statusMessageId) {
    await bot.api.editMessageText(
      job.telegramChatId,
      job.statusMessageId,
      firstText || 'Transcription completed, but no text was detected.'
    )
  } else {
    await bot.api.sendMessage(
      job.telegramChatId,
      firstText || 'Transcription completed, but no text was detected.',
      { reply_to_message_id: job.sourceMessageId }
    )
  }

  for (const chunk of chunks) {
    await bot.api.sendMessage(job.telegramChatId, chunk, {
      reply_to_message_id: job.sourceMessageId,
    })
  }
}
