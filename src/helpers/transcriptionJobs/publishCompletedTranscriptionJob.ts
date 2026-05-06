import { DocumentType } from '@typegoose/typegoose'
import {
  TelegramReachabilityFailureKind,
  classifyTelegramReachabilityFailure,
  markChatUnreachableByIdForTelegramError,
} from '@/helpers/chatReachability'
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

  const finalText = transcriptText(job).trim()
  if (job.silent && !finalText) {
    await deleteStatusMessage(job)
    await storeVoiceRecord(job)
    return
  }

  const chunks = splitTelegramText(finalText) || ['']
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
      const failure = classifyTelegramReachabilityFailure(error)
      if (failure.kind !== TelegramReachabilityFailureKind.benign) {
        await deleteStatusMessage(job)
        await sendFinalMessage(job, firstText || fallbackText, replyOptions)
      }
    }
  } else {
    await sendFinalMessage(job, firstText || fallbackText, replyOptions)
  }

  for (const chunk of chunks) {
    await sendFinalMessage(job, chunk, replyOptions)
  }

  await storeVoiceRecord(job)
}

async function sendFinalMessage(
  job: DocumentType<TranscriptionJob>,
  text: string,
  replyOptions: Record<string, number>
) {
  try {
    await bot.api.sendMessage(job.telegramChatId, text, {
      ...replyOptions,
    })
  } catch (error) {
    await markChatUnreachableByIdForTelegramError(job.chatId, error, {
      location: 'publishCompletedTranscriptionJob',
      action: 'sendMessage',
    })
    throw error
  }
}
