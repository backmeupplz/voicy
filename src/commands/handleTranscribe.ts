import { enqueueTranscription } from '@/handlers/handleAudio'
import { markdownI18n } from '@/helpers/telegramMarkdown'
import Context from '@/models/Context'
import fileUrl from '@/helpers/fileUrl'
import report from '@/helpers/report'

export default async function handleTranscribe(ctx: Context) {
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
    const message = ctx.msg.reply_to_message
    if (!message) {
      await ctx.reply(ctx.i18n.t('reply_to_voice'), {
        reply_to_message_id: ctx.msg.message_id,
      })
      return
    }

    const voice =
      message.voice || message.document || message.audio || message.video_note

    if (!voice) {
      await ctx.reply(ctx.i18n.t('reply_to_voice'), {
        reply_to_message_id: ctx.msg.message_id,
      })
      return
    }

    // Check size
    if (voice.file_size && voice.file_size >= 19 * 1024 * 1024) {
      if (!ctx.dbchat.silent) {
        await ctx.reply(markdownI18n(ctx, 'error_twenty'), {
          parse_mode: 'Markdown',
          reply_to_message_id: message.message_id,
        })
      }
      return
    }
    // Get full url to the voice message
    const fileData = await ctx.api.getFile(voice.file_id)
    const voiceUrl = fileUrl(fileData.file_path)

    await enqueueTranscription(
      ctx,
      voiceUrl,
      voice.file_id,
      message,
      fileData.file_path
    )
  } catch (error) {
    report(error, { ctx, location: 'handleTranscribe' })
    await ctx.reply(markdownI18n(ctx, 'error_queue'), {
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.msg?.message_id,
    })
  }
}
