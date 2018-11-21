// Load env variables
require('dotenv').config({ path: `${__dirname}/.env` })

// Dependencies
const Telegraf = require('telegraf')
const setupPromises = require('./helpers/setupPromises')
const setupMongoose = require('./helpers/setupMongoose')
const { setupAudioHandler } = require('./helpers/handler')
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

// Create bot
const bot = new Telegraf(process.env.TOKEN, {
  username: process.env.USERNAME,
  channelMode: true,
})
// Setup promises
setupPromises()
// Setup mongoose
setupMongoose()

// Setup checking for google credentials
setupCheckingCredentials(bot)
// Setup audio handler
setupAudioHandler(bot)

// Setup commands
setupHelp(bot)
setupStart(bot)
setupLanguage(bot)
setupEngine(bot)
setupLock(bot)
setupFiles(bot)
setupSilent(bot)
setupGoogle(bot)

// Setup keyboard callback handler
setupCallbackHandler(bot)

// Bot catch
bot.catch(err => {
  report(bot, err, 'bot.catch')
})

// Start bot
bot.startPolling()

// Console that everything is fine
console.info('Bot is up and running')
