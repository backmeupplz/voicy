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
const { setupCallbackHandler } = require('./helpers/callback')

// Create bot
const bot = new Telegraf(process.env.TOKEN, { username: process.env.USERNAME })
// Setup promises
setupPromises()
// Setup mongoose
setupMongoose()

// Setup audio handler
setupAudioHandler(bot)

// TODO: check if admin is locked before commands

// Setup commands
setupHelp(bot)
setupStart(bot)
setupLanguage(bot)
setupEngine(bot)
setupLock(bot)
setupFiles(bot)
setupSilent(bot)

// Setup keyboard callback handler
setupCallbackHandler(bot)

// Start bot
bot.startPolling()

// Consolethat everything is fine
console.info('Bot is up and running')
