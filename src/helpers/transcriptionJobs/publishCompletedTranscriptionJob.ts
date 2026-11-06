import { DocumentType } from '@typegoose/typegoose'
import { InlineKeyboardMarkup } from '@grammyjs/types'
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
import { guestInlineMessageIdsFromJob } from '@/helpers/telegramGuestMode'
import { keyboard } from '@/helpers/promo'
import { promoHook } from '@/helpers/promoHost'
import bot from '@/helpers/bot'
import localizedTranscriptionText from '@/helpers/localizedTranscriptionText'

type FinalReplyOptions = {
  reply_to_message_id?: number
}

// grammY options with the promo button, or none at all
const withMarkup = <T extends object>(
  options: T,
  markup: InlineKeyboardMarkup | undefined
) => (markup ? { ...options, reply_markup: markup } : options)

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
  const guestInlineMessageIds = guestInlineMessageIdsFromJob(job)
  if (guestInlineMessageIds.length > 0) {
    await editGuestFinalMessages(
      job,
      guestInlineMessageIds,
      firstText || fallbackText,
      chunks.length
    )
    await storeVoiceRecord(job)
    return
  }

  const replyOptions =
    job.telegramChatType === 'channel'
      ? {}
      : { reply_to_message_id: job.sourceMessageId }

  // Prime Radiant's group promos (promo.ts): in a group, one URL button on
  // this transcription (its last message) when the transcript matches a group
  // campaign's topics. The transcript is only matched in memory, here. Never
  // in guest mode.
  const decision = job.guestQueryId
    ? null
    : await promoHook.group(
        Number(job.telegramChatId),
        job.telegramChatType,
        job.uiLocale,
        finalText
      )
  const button = keyboard(decision?.promo) as InlineKeyboardMarkup | undefined
  let attached = false
  // Telegram refused the button: the transcript goes out without it
  let rejected = false
  const markupFor = (last: boolean) => (last && !rejected ? button : undefined)
  const send = async (text: string, last: boolean) => {
    const markup = markupFor(last)
    if (!(await sendFinalMessage(job, text, replyOptions, markup)) && markup)
      rejected = true
  }

  try {
    if (job.statusMessageId) {
      const statusMessageId = job.statusMessageId
      const edit = (markup?: InlineKeyboardMarkup) =>
        bot.api.editMessageText(
          job.telegramChatId,
          statusMessageId,
          firstText || fallbackText,
          ...(markup ? [{ reply_markup: markup }] : [])
        )
      try {
        const markup = markupFor(!chunks.length)
        try {
          await edit(markup)
        } catch (error) {
          if (!markup || !promoButtonMayBeRejected(error)) throw error
          console.error(
            'Promo button rejected on a transcription edit, editing without it',
            classifyTelegramReachabilityFailure(error).description
          )
          rejected = true
          await edit()
        }
        attached = !chunks.length
      } catch (error) {
        const failure = classifyTelegramReachabilityFailure(error)
        if (failure.kind !== TelegramReachabilityFailureKind.benign) {
          await deleteStatusMessage(job)
          await send(firstText || fallbackText, !chunks.length)
          attached = !chunks.length
        }
      }
    } else {
      await send(firstText || fallbackText, !chunks.length)
      attached = !chunks.length
    }

    for (const [index, chunk] of chunks.entries()) {
      const last = index === chunks.length - 1
      await send(chunk, last)
      attached = attached || last
    }
  } catch (error) {
    // the reply never went out: the group's promo cap isn't used up
    promoHook.release(decision)
    throw error
  }

  // seen (holdout too), and shown only if the button went out: before the
  // voice record, so a failed database write doesn't lose it
  await promoHook.record(decision, attached && !rejected)
  await storeVoiceRecord(job)
}

async function editGuestFinalMessages(
  job: DocumentType<TranscriptionJob>,
  guestInlineMessageIds: string[],
  firstText: string,
  remainingChunks: number
) {
  const text = guestFinalTranscriptionText(job, firstText, remainingChunks)
  for (const guestInlineMessageId of guestInlineMessageIds) {
    try {
      await bot.api.editMessageTextInline(guestInlineMessageId, text)
    } catch (error) {
      const failure = classifyTelegramReachabilityFailure(error)
      if (failure.kind !== TelegramReachabilityFailureKind.benign) {
        throw error
      }
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

// A Bad Request that isn't the chat being unreachable: on a message carrying
// the promo button, the button may be what Telegram refused (a bad URL or
// label), so that message goes out once more without it
function promoButtonMayBeRejected(error: unknown) {
  const failure = classifyTelegramReachabilityFailure(error)
  return (
    failure.code === 400 &&
    failure.kind === TelegramReachabilityFailureKind.transient
  )
}

// Sends one transcription message; false if it carried the promo button and
// went out without it because Telegram refused the message with the button
async function sendFinalMessage(
  job: DocumentType<TranscriptionJob>,
  text: string,
  replyOptions: FinalReplyOptions,
  markup?: InlineKeyboardMarkup
) {
  try {
    await sendFinalMessageOnce(job, text, replyOptions, markup)
    return true
  } catch (error) {
    if (!markup || !promoButtonMayBeRejected(error)) throw error
    console.error(
      'Promo button rejected on a transcription, sending without it',
      classifyTelegramReachabilityFailure(error).description
    )
    await sendFinalMessageOnce(job, text, replyOptions)
    return false
  }
}

async function sendFinalMessageOnce(
  job: DocumentType<TranscriptionJob>,
  text: string,
  replyOptions: FinalReplyOptions,
  markup?: InlineKeyboardMarkup
) {
  try {
    await bot.api.sendMessage(
      job.telegramChatId,
      text,
      withMarkup({ ...replyOptions }, markup)
    )
  } catch (error) {
    if (replyOptions.reply_to_message_id) {
      try {
        await bot.api.sendMessage(
          job.telegramChatId,
          text,
          withMarkup({}, markup)
        )
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
