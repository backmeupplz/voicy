import 'reflect-metadata'
// Setup @/ aliases for modules
import 'module-alias/register'
// Config dotenv
import * as dotenv from 'dotenv'
dotenv.config({ path: `${__dirname}/../.env` })
// Dependencies
import { RunnerHandle, run } from '@grammyjs/runner'
import { dropPendingTelegramUpdatesBeforePolling } from '@/helpers/staleTelegramUpdates'
import { ensurePromoInviteLinks, reportPromoJoin } from '@/helpers/promoStart'
import {
  handleBroadcastOptOut,
  startBroadcasts,
  stopBroadcasts,
} from '@/helpers/broadcast'
import {
  handleTelegramStarsPreCheckout,
  handleTelegramStarsSuccessfulPayment,
} from '@/handlers/handleTelegramStarsPayment'
import { markChatUnreachableForTelegramError } from '@/helpers/chatReachability'
import { webhookApp } from '@/helpers/startWebhook'
import Cluster from '@/helpers/Cluster'
import activityStreamMiddleware, {
  emitRuntimeActivity,
} from '@/helpers/activityStream'
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
import pollWithHandover from '@/helpers/handover'
import recordTimeReceived from '@/middlewares/recordTimeReceived'
import report from '@/helpers/report'
import startMongo from '@/helpers/startMongo'
import telegramAllowedUpdates from '@/helpers/telegramAllowedUpdates'

async function runApp() {
  console.log('Starting app...')
  // Mongo
  await startMongo()
  console.log('Mongo started')
  // The newest update fetched and the handlers still running, for handing polling over on deploys
  let lastUpdate = 0
  let handling = 0
  bot.use((ctx, next) => {
    lastUpdate = Math.max(lastUpdate, ctx.update.update_id)
    handling++
    return next().finally(() => handling--)
  })
  // Campaign joins to the channel; other chat_member updates stop here too
  bot.on('chat_member', (ctx) => reportPromoJoin(ctx))
  // Middlewares
  bot.use(recordTimeReceived)
  bot.use(activityStreamMiddleware)
  bot.use(countMessage)
  bot.use(handleGuestMessage)
  bot.use(ignoreOldMessageUpdates)
  bot.on('pre_checkout_query', handleTelegramStarsPreCheckout)
  bot.use(attachChat)
  bot.use(i18n.middleware())
  bot.use(configureI18n)
  bot.use(checkBanned)
  // Various events
  bot.on('my_chat_member', handleMyChatMember)
  bot.on(':successful_payment', handleTelegramStarsSuccessfulPayment)
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
  bot.callbackQuery(/^bco:/, handleBroadcastOptOut)
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
  // Start webhook app (Stripe and the transcription workers): every container serves it,
  // so a new one is healthy before it takes polling over
  webhookApp.listen(4242, () => console.log('Running on port 4242'))
  // Only the container holding the polling lock polls
  let runner: RunnerHandle
  await pollWithHandover(
    async () => {
      await dropPendingTelegramUpdatesBeforePolling(bot.api)
      runner = run(bot, 500, { allowed_updates: telegramAllowedUpdates })
      console.info(`Bot ${bot.botInfo.username} is up and running`)
      void ensurePromoInviteLinks({
        api: bot.api,
        me: bot.botInfo,
        chatId:
          process.env.VOICY_GOLDEN_BORODUTCH_CHAT_ID || '@golden_borodutch',
        names: (process.env.PROMO_INVITE_LINKS || '').split(','),
      }).catch((error) => console.error('promo invite links', error?.message))
      emitRuntimeActivity(`Voicy bot ${bot.botInfo.username} runtime started`)
      // approved broadcasts from Prime Radiant run only where polling runs
      startBroadcasts(bot.api)
    },
    async () => {
      await stopBroadcasts()
      await runner?.stop()
      // The runner does not confirm on stop: a zero-timeout getUpdates confirms
      // every update fetched, so the next poller does not get them again
      if (lastUpdate) {
        await bot.api.getUpdates({
          offset: lastUpdate + 1,
          limit: 1,
          timeout: 0,
        })
      }
    },
    async () => {
      while (handling) await new Promise((resolve) => setTimeout(resolve, 100))
    }
  )
}

if (Cluster.isPrimary) {
  void runApp()
}
