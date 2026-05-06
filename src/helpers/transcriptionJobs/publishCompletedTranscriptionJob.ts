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
  await VoiceModel.findOneAndUpdate(
    { chatId: job.chatId, messageId: job.sourceMessageId },
    {
      $set: {
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
        language:
          job.recognitionLanguage || job.recognitionLanguageHint || 'auto',
        text: transcriptText(job),
        textWithTimecodes: job.resultParts?.map((part) => [
          part.timeCode || '',
          part.text,
        ]),
        workerEngine: job.workerEngine,
      },
    },
    { upsert: true }
  )
}

function telegramErrorDescription(error: unknown) {
  return error && typeof error === 'object' && 'description' in error
    ? String((error as { description?: string }).description)
    : ''
}

async function deleteStatusMessage(job: DocumentType<TranscriptionJob>) {
  if (!job.statusMessageId) {
    return
  }

  try {
    await bot.api.deleteMessage(job.telegramChatId, job.statusMessageId)
  } catch (error) {
    console.error('Failed to delete stale transcription status message', error)
  }
}

export default async function publishCompletedTranscriptionJob(
  job: DocumentType<TranscriptionJob>
) {
  if (process.env.VOICY_DISABLE_TELEGRAM_PUBLISH === '1') {
    await storeVoiceRecord(job)
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
    try {
      await bot.api.editMessageText(
        job.telegramChatId,
        job.statusMessageId,
        firstText || fallbackText
      )
    } catch (error) {
      if (
        !telegramErrorDescription(error).includes('message is not modified')
      ) {
        await deleteStatusMessage(job)
        await bot.api.sendMessage(
          job.telegramChatId,
          firstText || fallbackText,
          {
            ...replyOptions,
          }
        )
      }
    }
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

  await storeVoiceRecord(job)
}
