import 'reflect-metadata'
// Setup @/ aliases for modules
import 'module-alias/register'
// Config dotenv
import * as dotenv from 'dotenv'
dotenv.config({ path: `${__dirname}/../.env` })
// Dependencies
import { run } from '@grammyjs/runner'
import { webhookApp } from '@/helpers/startWebhook'
import Cluster from '@/helpers/Cluster'
import attachChat from '@/middlewares/attachChat'
import bot from '@/helpers/bot'
import checkAdminLock from '@/middlewares/adminLock'
import checkDocumentType from '@/middlewares/checkDocumentType'
import checkFilesBanned from '@/middlewares/checkFilesBanned'
import checkGoogleCredentials from '@/handlers/checkGoogleCredentials'
import checkSuperAdmin from '@/middlewares/checkSuperAdmin'
import configureI18n from '@/middlewares/configureI18n'
import countMessage from '@/middlewares/countMessage'
import disallowPrivate from '@/middlewares/disallowPrivate'
import engines from '@/engines'
import handleAddPromoException from '@/commands/handleAddPromoException'
import handleAudio from '@/handlers/handleAudio'
import handleDisableGoogle from '@/commands/handleDisableGoogle'
import handleEnableGoogle from '@/commands/handleEnableGoogle'
import handleEngine from '@/commands/handleEngine'
import handleFiles from '@/commands/handleFiles'
import handleGeeky from '@/commands/handleGeeky'
import handleGoogle from '@/commands/handleGoogle'
import handleHelp from '@/commands/handleHelp'
import handleL from '@/commands/handleL'
import handleLanguage from '@/commands/handleLanguage'
import handleLock from '@/commands/handleLock'
import handleMyChatMember from '@/handlers/handleMyChatMember'
import handlePrivacy from '@/commands/handlePrivacy'
import handleSetEngine from '@/handlers/handleSetEngine'
import handleSetLanguage from '@/handlers/handleSetLanguage'
import handleSilent from '@/commands/handleSilent'
import handleStart from '@/commands/handleStart'
import handleTimecodes from '@/commands/handleTimecodes'
import handleUrl from '@/commands/handleUrl'
import handleViewPromoExceptions from './commands/handleViewPromoExceptions'
import handleWitToken from '@/commands/handleWitToken'
import i18n from '@/helpers/i18n'
import ignoreOldMessageUpdates from '@/middlewares/ignoreOldMessageUpdates'
import recordTimeReceived from '@/middlewares/recordTimeReceived'
import startMongo from '@/helpers/startMongo'

async function runApp() {
  console.log('Starting app...')
  // Mongo
  await startMongo()
  console.log('Mongo started')
  // Middlewares
  bot.use(recordTimeReceived)
  bot.use(countMessage)
  bot.use(ignoreOldMessageUpdates)
  bot.use(attachChat)
  bot.use(i18n.middleware())
  bot.use(configureI18n)
  // Various events
  bot.on('my_chat_member', handleMyChatMember)
  bot.on(':document', checkGoogleCredentials)
  bot.on([':voice', ':video_note'], handleAudio)
  bot.on(
    [':audio', ':document'],
    checkFilesBanned,
    checkDocumentType,
    handleAudio
  )
  // Commands
  bot.command('start', checkAdminLock, handleStart)
  bot.command('help', checkAdminLock, handleHelp)
  bot.command('lock', disallowPrivate, checkAdminLock, handleLock)
  bot.command('files', checkAdminLock, handleFiles)
  bot.command('silent', checkAdminLock, handleSilent)
  bot.command('geeky', checkAdminLock, handleGeeky)
  bot.command('timecodes', checkAdminLock, handleTimecodes)
  bot.command('url', checkAdminLock, handleUrl)
  bot.command('privacy', checkAdminLock, handlePrivacy)
  bot.command('witToken', checkAdminLock, handleWitToken)
  bot.command('engine', checkAdminLock, handleEngine)
  bot.command('google', checkAdminLock, handleGoogle)
  bot.command('enableGoogle', checkAdminLock, handleEnableGoogle)
  bot.command('disableGoogle', checkAdminLock, handleDisableGoogle)
  bot.command('language', checkAdminLock, handleLanguage)
  bot.command('l', checkAdminLock, handleL)
  bot.command('addPromoException', checkSuperAdmin, handleAddPromoException)
  bot.command('viewPromoExceptions', checkSuperAdmin, handleViewPromoExceptions)
  // Callabcks
  bot.callbackQuery(Object.keys(engines), handleSetEngine)
  bot.callbackQuery(/li.+/, handleSetLanguage)
  // Errors
  bot.catch(console.error)
  // Start bot
  await bot.init()
  run(bot)
  console.info(`Bot ${bot.botInfo.username} is up and running`)
  // Start webhook app
  webhookApp.listen(4242, () => console.log('Running on port 4242'))
}

if (Cluster.isPrimary) {
  void runApp()
}
