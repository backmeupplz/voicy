import 'reflect-metadata'
// Setup @/ aliases for modules
import 'module-alias/register'
// Config dotenv
import * as dotenv from 'dotenv'
dotenv.config({ path: `${__dirname}/../.env` })
// Dependencies
import startMongo from '@/helpers/startMongo'
import bot from '@/helpers/bot'
import { run } from '@grammyjs/runner'
import countMessage from '@/middlewares/countMessage'
import ignoreOldMessageUpdates from '@/middlewares/ignoreOldMessageUpdates'
import recordTimeReceived from '@/middlewares/recordTimeReceived'
import attachChat from '@/middlewares/attachChat'
import i18n from '@/helpers/i18n'
import configureI18n from '@/middlewares/configureI18n'
import checkAdminLock from '@/middlewares/adminLock'
import handleHelp from '@/commands/handleHelp'
import handleMyChatMember from '@/handlers/handleMyChatMember'
import disallowPrivate from '@/middlewares/disallowPrivate'
import handleLock from '@/commands/handleLock'
import handleFiles from '@/commands/handleFiles'
import handleSilent from '@/commands/handleSilent'
import handleGeeky from '@/commands/handleGeeky'
import handleTimecodes from '@/commands/handleTimecodes'
import handleUrl from '@/commands/handleUrl'
import handlePrivacy from '@/commands/handlePrivacy'
import handleWitToken from '@/commands/handleWitToken'
import handleEngine from '@/commands/handleEngine'
import handleSetEngine from '@/handlers/handleSetEngine'
import engines from '@/engines'
import handleGoogle from '@/commands/handleGoogle'
import handleEnableGoogle from '@/commands/handleEnableGoogle'
import handleDisableGoogle from '@/commands/handleDisableGoogle'
import checkGoogleCredentials from '@/handlers/checkGoogleCredentials'
import handleLanguage from '@/commands/handleLanguage'
import handleL from '@/commands/handleL'
import handleStart from '@/commands/handleStart'
import handleSetLanguage from '@/handlers/handleSetLanguage'

async function runApp() {
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
  bot.on(':file', checkGoogleCredentials)
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
  // Callabcks
  bot.callbackQuery(Object.keys(engines), handleSetEngine)
  bot.callbackQuery(/li.+/, handleSetLanguage)
  // Errors
  bot.catch(console.error)
  // Start bot
  await bot.init()
  run(bot)
  console.info(`Bot ${bot.botInfo.username} is up and running`)
}

runApp()

// Audio handler
// setupAudioHandler(bot)
