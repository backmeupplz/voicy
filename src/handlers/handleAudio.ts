import { Chat } from '@/models/Chat'
import { Message } from '@grammyjs/types'
import { addVoice } from '@/models/Voice'
import { pick } from 'lodash'
import Context from '@/models/Context'
import Engine from '@/helpers/engine/Engine'
import addPromoToText from '@/helpers/addPromoToText'
import fileUrl from '@/helpers/fileUrl'
import report from '@/helpers/report'
import urlToText from '@/helpers/urlToText'

export default async function handleAudio(ctx: Context) {
  try {
    // await ctx.reply(ctx.i18n.t('sunsetting'), {
    //   parse_mode: 'Markdown',
    //   reply_to_message_id: ctx.msg.message_id,
    //   disable_web_page_preview: true,
    // })
    const message = ctx.msg
    const voice =
      message.voice || message.document || message.audio || message.video_note
    // Check size
    if (voice.file_size && voice.file_size >= 19 * 1024 * 1024) {
      if (!ctx.dbchat.silent) {
        await sendLargeFileError(ctx)
      }
      return
    }
    // Get full url to the voice message
    const fileData = await ctx.getFile()
    const voiceUrl = await fileUrl(fileData.file_path)
    // Send action or transcription depending on whether chat is silent
    await sendTranscription(ctx, voiceUrl, voice.file_id)
  } catch (error) {
    report(error, { ctx, location: 'handleMessage' })
  }
}

function sendLargeFileError(ctx: Context) {
  return ctx.reply(ctx.i18n.t('error_twenty'), {
    parse_mode: 'Markdown',
    reply_to_message_id: ctx.msg.message_id,
  })
}

async function sendTranscription(ctx: Context, url: string, fileId: string) {
  // Send typing action or dummy message
  let dummyMessage: Message
  if (ctx.dbchat.silent) {
    await ctx.replyWithChatAction('typing')
  } else {
    dummyMessage = await ctx.reply(ctx.i18n.t('initiated'), {
      reply_to_message_id: ctx.msg.message_id,
      parse_mode: 'Markdown',
    })
  }
  // Check if ok with google engine
  if (ctx.dbchat.engine === 'google' && !ctx.dbchat.googleKey) {
    if (dummyMessage) {
      await ctx.api.editMessageText(
        ctx.dbchat.id,
        dummyMessage.message_id,
        ctx.i18n.t('google_error_creds'),
        {
          parse_mode: 'Markdown',
        }
      )
    }
    return
  }
  try {
    // Convert utl to text
    const { textWithTimecodes, duration } = await urlToText(
      url,
      sanitizeChat(ctx.dbchat),
      ctx.msg.forward_from?.id || ctx.from?.id,
      ctx.msg.forward_sender_name
    )
    // Send trancription to user
    const text = ctx.dbchat.timecodesEnabled
      ? textWithTimecodes
          .map((t) => `${t.timeCode}:\n${t.text || ''}`)
          .join('\n')
      : textWithTimecodes
          .map((t) => (t.text || '').trim())
          .filter((v) => !!v)
          .join('. ')
    const texts = splitText(text) || ['']
    const firstText = texts.shift().trim()
    if (dummyMessage) {
      await ctx.api.editMessageText(
        ctx.dbchat.id,
        dummyMessage.message_id,
        firstText
          ? addPromoToText(ctx, firstText)
          : ctx.i18n.t('speak_clearly'),
        {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }
      )
    } else if (firstText) {
      await ctx.reply(addPromoToText(ctx, firstText), {
        reply_to_message_id: ctx.msg.message_id,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      })
    }
    if (texts.length) {
      for (const element of texts) {
        await ctx.reply(element, {
          reply_to_message_id: ctx.msg.message_id,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        })
      }
    }
    await addVoice({
      url,
      textWithTimecodes,
      chat: ctx.dbchat,
      duration,
      fileId,
    })
  } catch (error) {
    if (dummyMessage) {
      let text = ctx.i18n.t('error')
      if (ctx.dbchat.engine === Engine.google) {
        text = `${text}\n\n\`\`\`\n${error.message || 'Unknown error'}\n\`\`\``
      }
      try {
        await ctx.api.editMessageText(
          ctx.dbchat.id,
          dummyMessage.message_id,
          text,
          {
            parse_mode: 'Markdown',
          }
        )
      } catch (error) {
        report(error, { ctx, location: 'updateMessagewithError' })
      }
    }
    try {
      // Check if it's the wrong wit token and remove it
      if (ctx.dbchat.engine === Engine.wit && ctx.dbchat.witToken) {
        const errors = [
          'Invalid character in header content',
          'Bad auth, check token/params',
        ]
        if (errors.find((e) => error.message?.includes(e))) {
          ctx.dbchat.witToken = undefined
          await ctx.dbchat.save()
        }
      }
    } catch (error) {
      report(error, { ctx, location: 'removeBadWitToken' })
    }
    report(error, { ctx, location: 'sendTranscription' })
  } finally {
    console.info(
      `audio message processed in ${
        (new Date().getTime() - ctx.timeReceived.getTime()) / 1000
      }s`
    )
  }
}

function splitText(text: string): string[] {
  const chunks = text.match(/[\s\S]{1,4000}/g)
  return chunks
}

function sanitizeChat(chat: Chat): Partial<Chat> {
  return pick(chat, [
    'id',
    'engine',
    'adminLocked',
    'silent',
    'filesBanned',
    'googleSetupMessageId',
    'googleKey',
    'languages',
    'witToken',
  ])
}
