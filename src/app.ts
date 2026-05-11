import 'reflect-metadata'
// Setup @/ aliases for modules
import 'module-alias/register'
// Config dotenv
import * as dotenv from 'dotenv'
dotenv.config({ path: `${__dirname}/../.env` })
// Dependencies
import { dropPendingTelegramUpdatesBeforePolling } from '@/helpers/staleTelegramUpdates'
import { markChatUnreachableForTelegramError } from '@/helpers/chatReachability'
import { run } from '@grammyjs/runner'
import { webhookApp } from '@/helpers/startWebhook'
import Cluster from '@/helpers/Cluster'
import attachChat from '@/middlewares/attachChat'
import bot from '@/helpers/bot'
import checkAdminLock from '@/middlewares/adminLock'
import checkBanned from '@/handlers/checkBanned'
import checkDocumentType from '@/middlewares/checkDocumentType'
import checkFilesBanned from '@/middlewares/checkFilesBanned'
import configureBotCommands from '@/helpers/configureBotCommands'
import configureI18n from '@/middlewares/configureI18n'
import countMessage from '@/middlewares/countMessage'
import disallowPrivate from '@/middlewares/disallowPrivate'
import handleAudio from '@/handlers/handleAudio'
import handleDonate from '@/commands/handleDonate'
import handleFiles from '@/commands/handleFiles'
import handleGuestMessage from '@/handlers/handleGuestMessage'
import handleHelp from '@/commands/handleHelp'
import handleId from '@/commands/handleId'
import handleLanguage from '@/commands/handleLanguage'
import handleLock from '@/commands/handleLock'
import handleMyChatMember from '@/handlers/handleMyChatMember'
import handlePrivacy from '@/commands/handlePrivacy'
import handleSetLanguage from '@/handlers/handleSetLanguage'
import handleSilent from '@/commands/handleSilent'
import handleStart from '@/commands/handleStart'
import handleTranscribe from './commands/handleTranscribe'
import handleTranscribeAll from './commands/handleTranscribeAll'
import i18n from '@/helpers/i18n'
import ignoreOldMessageUpdates from '@/middlewares/ignoreOldMessageUpdates'
import recordTimeReceived from '@/middlewares/recordTimeReceived'
import report from '@/helpers/report'
import startMongo from '@/helpers/startMongo'
import telegramAllowedUpdates from '@/helpers/telegramAllowedUpdates'

async function runApp() {
  console.log('Starting app...')
  // Mongo
  await startMongo()
  console.log('Mongo started')
  // Middlewares
  bot.use(recordTimeReceived)
  bot.use(countMessage)
  bot.use(handleGuestMessage)
  bot.use(ignoreOldMessageUpdates)
  bot.use(attachChat)
  bot.use(i18n.middleware())
  bot.use(configureI18n)
  bot.use(checkBanned)
  // Various events
  bot.on('my_chat_member', handleMyChatMember)
  bot.on([':voice', ':video_note'], handleAudio)
  bot.on(
    [':audio', ':document', ':video'],
    checkFilesBanned,
    checkDocumentType,
    handleAudio
  )
  // Commands
  bot.command('donate', handleDonate)
  bot.command('start', checkAdminLock, handleStart)
  bot.command('help', checkAdminLock, handleHelp)
  bot.command('id', handleId)
  bot.command('lock', disallowPrivate, checkAdminLock, handleLock)
  bot.command('files', checkAdminLock, handleFiles)
  bot.command('silent', checkAdminLock, handleSilent)
  bot.command('privacy', checkAdminLock, handlePrivacy)
  bot.command('language', checkAdminLock, handleLanguage)
  bot.command('transcribe_all', checkAdminLock, handleTranscribeAll)
  bot.command('transcribe', checkAdminLock, handleTranscribe)
  // Callabcks
  bot.callbackQuery(/li.+/, handleSetLanguage)
  // Errors
  bot.catch(async (error) => {
    await markChatUnreachableForTelegramError(error.ctx, error.error, {
      location: 'bot.catch',
    })
    report(error.error, { ctx: error.ctx, location: 'bot.catch' })
  })
  // Start bot
  await bot.init()
  await configureBotCommands()
  await dropPendingTelegramUpdatesBeforePolling(bot.api)
  run(bot, 500, { allowed_updates: telegramAllowedUpdates })
  console.info(`Bot ${bot.botInfo.username} is up and running`)
  // Start webhook app
  webhookApp.listen(4242, () => console.log('Running on port 4242'))
}

if (Cluster.isPrimary) {
  void runApp()
}
