import Context from '@/models/Context'
import bot from '@/helpers/bot'
import download from 'download'
import fileUrl from '@/helpers/fileUrl'
import logAnswerTime from '@/helpers/logAnswerTime'
import report from '@/helpers/report'

export default async function checkGoogleCredentials(ctx: Context) {
  const replyToMessage = ctx.message?.reply_to_message
  // Check if reply
  if (!replyToMessage) {
    return
  }
  // Check if reply is to a bot's message
  if (replyToMessage.from?.id !== bot.botInfo.id) {
    return
  }
  // Check if reply is to the credentials request message
  if (replyToMessage.message_id !== ctx.dbchat.googleSetupMessageId) {
    return
  }
  // Check if the document exists
  const document = ctx.message?.document
  if (!document) {
    return
  }
  // Check document type
  if (
    !document.file_name ||
    (!document.file_name.includes('json') &&
      !document.file_name.includes('txt'))
  ) {
    return ctx.reply(ctx.i18n.t('google_error_mime'), {
      parse_mode: 'Markdown',
    })
  }
  try {
    // Download the file
    const fileData = await ctx.api.getFile(document.file_id)
    const url = await fileUrl(fileData.file_path)
    // Download credentials file
    const data = await download(url)
    // Save to chat
    ctx.dbchat.googleKey = data.toString('utf8')
    await ctx.dbchat.save()
    // Reply with confirmation
    await ctx.reply(
      ctx.i18n.t('google_success', {
        projectId: JSON.parse(ctx.dbchat.googleKey).project_id,
      }),
      {
        parse_mode: 'Markdown',
      }
    )
    // Log time
    logAnswerTime(ctx, 'credentials check')
  } catch (error) {
    report(error, { ctx, location: 'setupCheckingCredentials' })
  }
}
