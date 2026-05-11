import { DocumentType } from '@typegoose/typegoose'
import {
  TELEGRAM_MESSAGE_LIMIT,
  splitTelegramText,
  transcriptText,
} from '@/helpers/transcriptionJobs/transcriptFormatting'
import {
  TelegramReachabilityFailureKind,
  classifyTelegramReachabilityFailure,
  markChatUnreachableByIdForTelegramError,
} from '@/helpers/chatReachability'
import { TranscriptionJob } from '@/models/TranscriptionJob'
import { VoiceModel } from '@/models/Voice'
import bot from '@/helpers/bot'
import localizedTranscriptionText from '@/helpers/localizedTranscriptionText'

type FinalReplyOptions = {
  reply_to_message_id?: number
}

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

  const finalText = transcriptText(job, {
    includeTimecodes: !job.silent,
  }).trim()
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
  if (job.guestInlineMessageId) {
    await editGuestFinalMessage(job, firstText || fallbackText, chunks.length)
    await storeVoiceRecord(job)
    return
  }

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

async function editGuestFinalMessage(
  job: DocumentType<TranscriptionJob>,
  firstText: string,
  remainingChunks: number
) {
  try {
    await bot.api.editMessageTextInline(
      job.guestInlineMessageId || '',
      guestFinalTranscriptionText(job, firstText, remainingChunks)
    )
  } catch (error) {
    const failure = classifyTelegramReachabilityFailure(error)
    if (failure.kind !== TelegramReachabilityFailureKind.benign) {
      throw error
    }
  }
}

function guestFinalTranscriptionText(
  job: DocumentType<TranscriptionJob>,
  firstText: string,
  remainingChunks: number
) {
  if (remainingChunks <= 0) {
    return firstText
  }

  const suffix = localizedTranscriptionText(
    job.uiLocale,
    'guest_result_truncated'
  )
  const separator = '\n\n'
  const allowedTextLength = Math.max(
    TELEGRAM_MESSAGE_LIMIT - suffix.length - separator.length,
    0
  )
  return `${firstText.slice(0, allowedTextLength)}${separator}${suffix}`
}

async function sendFinalMessage(
  job: DocumentType<TranscriptionJob>,
  text: string,
  replyOptions: FinalReplyOptions
) {
  try {
    await bot.api.sendMessage(job.telegramChatId, text, {
      ...replyOptions,
    })
  } catch (error) {
    if (replyOptions.reply_to_message_id) {
      try {
        await bot.api.sendMessage(job.telegramChatId, text)
        return
      } catch (fallbackError) {
        await markChatUnreachableByIdForTelegramError(
          job.chatId,
          fallbackError,
          {
            location: 'publishCompletedTranscriptionJob',
            action: 'sendMessage',
          }
        )
        throw fallbackError
      }
    }

    await markChatUnreachableByIdForTelegramError(job.chatId, error, {
      location: 'publishCompletedTranscriptionJob',
      action: 'sendMessage',
    })
    throw error
  }
}

export { guestFinalTranscriptionText }
