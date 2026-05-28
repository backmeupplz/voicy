import { enqueueTranscription } from '@/handlers/handleAudio'
import { isMediaTooLarge } from '@/helpers/mediaSizeLimit'
import { markChatUnreachableForTelegramError } from '@/helpers/chatReachability'
import { markdownI18n } from '@/helpers/telegramMarkdown'
import { transcribableMediaFromMessage } from '@/helpers/transcribableTelegramMedia'
import Context from '@/models/Context'
import report from '@/helpers/report'

export default async function handleTranscribe(ctx: Context) {
  try {
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
        await ctx.reply(markdownI18n(ctx, 'error_file_too_large'), {
          parse_mode: 'Markdown',
          reply_to_message_id: message.message_id,
        })
      }
      return
    }
    await enqueueTranscription(ctx, voice.file_id, message)
  } catch (error) {
    report(error, { ctx, location: 'handleTranscribe' })
    if (!ctx.dbchat.silent) {
      try {
        await ctx.reply(markdownI18n(ctx, 'error_queue'), {
          parse_mode: 'Markdown',
          reply_to_message_id: ctx.msg?.message_id,
        })
      } catch (replyError) {
        await markChatUnreachableForTelegramError(ctx, replyError, {
          location: 'handleTranscribe.errorReply',
          action: 'reply',
        })
        report(replyError, { ctx, location: 'handleTranscribe.errorReply' })
      }
    }
  }
}
