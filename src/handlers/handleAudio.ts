import { Message } from '@grammyjs/types'
import {
  TranscriptionJobModel,
  TranscriptionJobSourceKind,
  TranscriptionJobStatus,
} from '@/models/TranscriptionJob'
import { markdownI18n } from '@/helpers/telegramMarkdown'
import Context from '@/models/Context'
import fileUrl from '@/helpers/fileUrl'
import report from '@/helpers/report'

type AudioPayload = {
  file_id: string
  file_size?: number
  mime_type?: string
  file_name?: string
  file_unique_id?: string
  sourceType: 'voice' | 'audio' | 'document' | 'video_note'
}

export default async function handleAudio(ctx: Context) {
  try {
    if (!ctx.dbchat.paid) {
      console.log('Sending the donate message')
      await ctx.reply(markdownI18n(ctx, 'sunsetting'), {
        parse_mode: 'Markdown',
        reply_to_message_id: ctx.msg.message_id,
        disable_web_page_preview: true,
      })
      return
    }

    const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup'
    if (!ctx.dbchat.transcribeAllAudio && isGroup) {
      console.log('Ignored cause transcribeAllAudio is false')
      return
    }

    const message = ctx.msg
    const audio = audioFromMessage(message)
    if (audio.file_size && audio.file_size >= 19 * 1024 * 1024) {
      if (!ctx.dbchat.silent) {
        await sendLargeFileError(ctx)
      }
      return
    }

    const fileData = await ctx.getFile()
    const voiceUrl = fileUrl(fileData.file_path)
    await enqueueTranscription(
      ctx,
      voiceUrl,
      audio.file_id,
      message,
      fileData.file_path
    )
  } catch (error) {
    report(error, { ctx, location: 'handleMessage' })
    await sendQueueError(ctx)
  }
}

function sendLargeFileError(ctx: Context) {
  return ctx.reply(markdownI18n(ctx, 'error_twenty'), {
    parse_mode: 'Markdown',
    reply_to_message_id: ctx.msg.message_id,
  })
}

async function enqueueTranscription(
  ctx: Context,
  url: string,
  fileId: string,
  sourceMessage: Message = ctx.msg,
  filePath?: string
) {
  const audio = audioFromMessage(sourceMessage)
  const queuedJob = await TranscriptionJobModel.create({
    status: TranscriptionJobStatus.queued,
    chatId: ctx.dbchat.id,
    telegramChatId: String(ctx.chat.id),
    sourceMessageId: sourceMessage.message_id,
    requestMessageId: ctx.msg?.message_id,
    fileId,
    filePath,
    fileSize: audio.file_size,
    mimeType: audio.mime_type,
    fileUniqueId: fileUniqueId(audio),
    sourceKind: sourceKind(audio.sourceType),
    sourceUrl: url,
    requestedByUserId: ctx.from?.id ? String(ctx.from.id) : undefined,
    forwardedFromUserId: sourceMessage.forward_from?.id
      ? String(sourceMessage.forward_from.id)
      : undefined,
    forwardSenderName: sourceMessage.forward_sender_name,
    uiLocale: ctx.dbchat.uiLanguage,
  })

  try {
    const ackMessage = await ctx.reply(markdownI18n(ctx, 'initiated'), {
      reply_to_message_id: sourceMessage.message_id,
      parse_mode: 'Markdown',
    })
    queuedJob.statusMessageId = ackMessage.message_id
    await queuedJob.save()
  } catch (error) {
    report(error, { ctx, location: 'ackQueuedTranscription' })
  }

  console.info(
    `audio message queued in ${
      (new Date().getTime() - ctx.timeReceived.getTime()) / 1000
    }s`
  )
  return queuedJob
}

function sourceKind(sourceType: AudioPayload['sourceType']) {
  if (sourceType === 'video_note') {
    return TranscriptionJobSourceKind.videoNote
  }
  return sourceType as TranscriptionJobSourceKind
}

function fileUniqueId(audio: AudioPayload) {
  return 'file_unique_id' in audio ? audio.file_unique_id : undefined
}

function audioFromMessage(message: Message): AudioPayload {
  if (message.voice) {
    return { ...message.voice, sourceType: 'voice' }
  }
  if (message.audio) {
    return { ...message.audio, sourceType: 'audio' }
  }
  if (message.document) {
    return { ...message.document, sourceType: 'document' }
  }
  if (message.video_note) {
    return { ...message.video_note, sourceType: 'video_note' }
  }
  throw new Error('No supported audio payload found on message')
}

async function sendQueueError(ctx: Context) {
  try {
    await ctx.reply(markdownI18n(ctx, 'error_queue'), {
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.msg?.message_id,
    })
  } catch (error) {
    report(error, { ctx, location: 'sendQueueError' })
  }
}

export { enqueueTranscription }
