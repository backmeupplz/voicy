import { ChatModel } from '@/models/Chat'
import { sendTranscription } from '@/handlers/handleAudio'
import Context from '@/models/Context'
import fileUrl from '@/helpers/fileUrl'
import report from '@/helpers/report'

export default async function handleTranscribe(ctx: Context) {
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
    if (!ctx.dbchat.paid) {
      await ChatModel.updateOne(
        { id: ctx.dbchat.id },
        { $inc: { freeVoicesUsed: 1 } }
      )
    }

    const message = ctx.msg.reply_to_message
    if (!message) {
      await ctx.reply(ctx.i18n.t('reply_to_voice'), {
        reply_to_message_id: ctx.msg.message_id,
      })
      return
    }

    const voice =
      message.voice || message.document || message.audio || message.video_note
    // Check size
    if (voice.file_size && voice.file_size >= 19 * 1024 * 1024) {
      if (!ctx.dbchat.silent) {
        await ctx.reply(ctx.i18n.t('error_twenty'), {
          parse_mode: 'Markdown',
          reply_to_message_id: message.message_id,
        })
      }
      return
    }
    // Get full url to the voice message
    const fileData = await ctx.api.getFile(voice.file_id)
    const voiceUrl = fileUrl(fileData.file_path)

    // Sets message id to the original voice message's id
    ctx.msg.message_id = message.message_id
    // Send action or transcription depending on whether chat is silent
    await sendTranscription(ctx, voiceUrl, voice.file_id)
  } catch (error) {
    report(error, { ctx, location: 'handleTranscribe' })
  }
}
