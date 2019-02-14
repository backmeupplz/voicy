// Load env variables
require('dotenv').config({ path: `${__dirname}/.env` })

// Dependencies
const Telegraf = require('telegraf')
const setupPromises = require('./helpers/setupPromises')
const setupMongoose = require('./helpers/setupMongoose')
const { setupAudioHandler } = require('./helpers/handler')
const setupCounter = require('./models/stats')
const { setupHelp } = require('./commands/help')
const { setupStart } = require('./commands/start')
const { setupLanguage } = require('./commands/language')
const { setupEngine } = require('./commands/engine')
const { setupLock } = require('./commands/lock')
const { setupFiles } = require('./commands/files')
const { setupSilent } = require('./commands/silent')
const { setupGoogle, setupCheckingCredentials } = require('./commands/google')
const { setupCallbackHandler } = require('./helpers/callback')
const report = require('./helpers/report')
const cluster = require('cluster')

// Create bot
const bot = new Telegraf(process.env.TOKEN, {
  username: process.env.USERNAME,
  channelMode: true,
})
bot.use((ctx, next) => {
  console.log('1')
  next()
})
// Get bot's username
bot.telegram.getMe().then(info => {
  bot.options.username = info.username
})
// Setup promises
setupPromises()
// Setup mongoose
setupMongoose()
bot.use((ctx, next) => {
  console.log('2')
  next()
})

// Setup checking for google credentials
setupCheckingCredentials(bot)
// Setup audio handler
setupAudioHandler(bot)
// Setup stats counter
setupCounter(bot)
bot.use((ctx, next) => {
  console.log('3')
  next()
})

// Setup commands
setupHelp(bot)
setupStart(bot)
setupLanguage(bot)
setupEngine(bot)
setupLock(bot)
setupFiles(bot)
setupSilent(bot)
setupGoogle(bot)
bot.use((ctx, next) => {
  console.log('4')
  next()
})

// Setup keyboard callback handler
setupCallbackHandler(bot)

// Bot catch
bot.catch(err => {
  report(bot, err, 'bot.catch')
})

if (cluster.isMaster) {
  // Start bot
  if (process.env.USE_WEBHOOK === 'true') {
    const domain = process.env.WEBHOOK_DOMAIN;
    bot.launch({ webhook: { domain, port: 5000 } })
      .then(async () => {
        const webhookInfo = await bot.telegram.getWebhookInfo()
        console.info('Bot is up and running with webhooks', webhookInfo)
      })
      .catch(err => console.error('Bot launch error', err))
  } else {
    bot.startPolling()
    // Console that everything is fine
    console.info('Bot is up and running')
  }
}
