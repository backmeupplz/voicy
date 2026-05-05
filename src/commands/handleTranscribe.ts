import { enqueueTranscription, isMediaTooLarge } from '@/handlers/handleAudio'
import { isTranscriptionAllowedByDonationWall } from '@/helpers/donationWall'
import { markdownI18n } from '@/helpers/telegramMarkdown'
import { transcribableMediaFromMessage } from '@/helpers/transcribableTelegramMedia'
import Context from '@/models/Context'
import report from '@/helpers/report'

export default async function handleTranscribe(ctx: Context) {
  try {
    if (!isTranscriptionAllowedByDonationWall(ctx.dbchat)) {
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

    const voice = transcribableMediaFromMessage(message)

    if (!voice) {
      await ctx.reply(ctx.i18n.t('reply_to_voice'), {
        reply_to_message_id: ctx.msg.message_id,
      })
      return
    }

    // Check size
    if (isMediaTooLarge(voice.file_size)) {
      if (!ctx.dbchat.silent) {
        await ctx.reply(markdownI18n(ctx, 'error_twenty'), {
          parse_mode: 'Markdown',
          reply_to_message_id: message.message_id,
        })
      }
      return
    }
    await enqueueTranscription(ctx, voice.file_id, message)
  } catch (error) {
    report(error, { ctx, location: 'handleTranscribe' })
    await ctx.reply(markdownI18n(ctx, 'error_queue'), {
      parse_mode: 'Markdown',
      reply_to_message_id: ctx.msg?.message_id,
    })
  }
}
