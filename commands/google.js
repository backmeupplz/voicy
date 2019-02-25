// Dependencies
const { findChat } = require('../helpers/db')
const { fileUrl } = require('../helpers/url')
const download = require('download')
const { report } = require('../helpers/report')
const logAnswerTime = require('../helpers/logAnswerTime')
const checkAdminLock = require('../middlewares/adminLock')

function setupGoogle(bot) {
  bot.command('google', checkAdminLock, async ctx => {
    handleGoogle(ctx)
  })

  bot.command('enableGoogle', checkAdminLock, async ctx => {
    handleEnableGoogle(ctx)
  })

  bot.command('disableGoogle', checkAdminLock, async ctx => {
    handleDisableGoogle(ctx)
  })
}

async function handleGoogle(ctx) {
  // Send message
  const msg = await ctx.replyWithMarkdown(ctx.i18n.t('google'))
  // Save msg to chat
  ctx.dbchat.googleSetupMessageId = msg.message_id
  await ctx.dbchat.save()
  // Log time
  logAnswerTime(ctx, '/google')
}

async function handleEnableGoogle(ctx) {
  // Get sender
  const sender = await findChat(ctx.from.id)
  // Check if google key exists on user
  if (!sender.googleKey) {
    await ctx.replyWithMarkdown(ctx.i18n.t('google_enable_personal_not_setup'))
    return
  }
  // Setup google key
  ctx.dbchat.googleKey = sender.googleKey
  await ctx.dbchat.save()
  // Send message
  await ctx.replyWithMarkdown(ctx.i18n.t('google_enable_success'))
}

async function handleDisableGoogle(ctx) {
  // Get sender
  const sender = await findChat(ctx.from.id)
  // Check if google key exists on user
  if (!sender.googleKey) {
    await ctx.replyWithMarkdown(ctx.i18n.t('google_disable_personal_not_setup'))
    return
  }
  // Check if google key is the same
  if (sender.googleKey !== ctx.dbchat.googleKey) {
    await ctx.replyWithMarkdown(ctx.i18n.t('google_disable_error_wrong_key'))
    return
  }
  // Setup google key
  ctx.dbchat.googleKey = undefined
  await ctx.dbchat.save()
  // Send message
  await ctx.replyWithMarkdown(ctx.i18n.t('google_disable_success'))
}

function setupCheckingCredentials(bot) {
  bot.use(async (ctx, next) => {
    // Continue
    next()
    // Check credentials
    try {
      // Get message
      const msg = ctx.message || ctx.update.channel_post
      // Check if reply to bot
      if (
        msg &&
        msg.reply_to_message &&
        msg.reply_to_message.from &&
        msg.reply_to_message.from.username === bot.options.username
      ) {
        // Check if reply to setup message
        if (
          ctx.dbchat.googleSetupMessageId &&
          ctx.dbchat.googleSetupMessageId === msg.reply_to_message.message_id
        ) {
          // Check if document
          if (!msg.document) {
            ctx.reply(ctx.i18n.t('google_error_doc'))
            return
          }
          // Check file name
          if (
            !msg.document.file_name ||
            (msg.document.file_name.indexOf('json') < 0 &&
              msg.document.file_name.indexOf('txt') < 0)
          ) {
            ctx.reply(ctx.i18n.t('google_error_mime'))
            return
          }
          // Download the file
          const fileData = await ctx.telegram.getFile(msg.document.file_id)
          const url = await fileUrl(fileData.file_path)
          // Download credentials file
          const data = await download(url)
          // Save to chat
          ctx.dbchat.googleKey = data.toString('utf8')
          await ctx.dbchat.save()
          // Reply with confirmation
          await ctx.replyWithMarkdown(
            ctx.i18n.t('google_success', {
              projectId: JSON.parse(ctx.dbchat.googleKey).project_id,
            })
          )
          // Log time
          logAnswerTime(ctx, 'credentials check')
        }
      }
    } catch (err) {
      report(bot, err, 'setupCheckingCredentials')
    }
  })
}

// Exports
module.exports = {
  setupGoogle,
  setupCheckingCredentials,
}
