import { Message } from '@grammyjs/types'
import { addQueuedVoice } from '@/models/Voice'
import Context from '@/models/Context'
import fileUrl from '@/helpers/fileUrl'
import report from '@/helpers/report'

type AudioPayload = {
  file_id: string
  file_size?: number
  mime_type?: string
  file_name?: string
  sourceType: 'voice' | 'audio' | 'document' | 'video_note'
}

export default async function handleAudio(ctx: Context) {
  try {
    if (!ctx.dbchat.paid) {
      console.log('Sending the donate message')
      await ctx.reply(ctx.i18n.t('sunsetting'), {
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
    await enqueueTranscription(ctx, voiceUrl, audio.file_id, message)
  } catch (error) {
    report(error, { ctx, location: 'handleMessage' })
    await sendQueueError(ctx)
  }
}

function sendLargeFileError(ctx: Context) {
  return ctx.reply(ctx.i18n.t('error_twenty'), {
    parse_mode: 'Markdown',
    reply_to_message_id: ctx.msg.message_id,
  })
}

async function enqueueTranscription(
  ctx: Context,
  url: string,
  fileId: string,
  sourceMessage: Message = ctx.msg
) {
  const audio = audioFromMessage(sourceMessage)
  const queuedVoice = await addQueuedVoice({
    url,
    chat: ctx.dbchat,
    messageId: sourceMessage.message_id,
    fileId,
    fileSize: audio.file_size,
    mimeType: audio.mime_type,
    fileName: audio.file_name,
    sourceType: audio.sourceType,
    requestedBy: ctx.from?.id,
    forwardFromId: sourceMessage.forward_from?.id,
    forwardSenderName: sourceMessage.forward_sender_name,
  })

  try {
    const ackMessage = await ctx.reply(ctx.i18n.t('initiated'), {
      reply_to_message_id: sourceMessage.message_id,
      parse_mode: 'Markdown',
    })
    queuedVoice.ackMessageId = ackMessage.message_id
    await queuedVoice.save()
  } catch (error) {
    report(error, { ctx, location: 'ackQueuedTranscription' })
  }

  console.info(
    `audio message queued in ${
      (new Date().getTime() - ctx.timeReceived.getTime()) / 1000
    }s`
  )
  return queuedVoice
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
    await ctx.reply(ctx.i18n.t('error_queue'), {
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.msg?.message_id,
    })
  } catch (error) {
    report(error, { ctx, location: 'sendQueueError' })
  }
}

export { enqueueTranscription }
