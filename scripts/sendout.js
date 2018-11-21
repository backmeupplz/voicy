// Load env variables
require('dotenv').config({ path: `${__dirname}/../.env` })

// Dependencies
const Telegraf = require('telegraf')
const setupPromises = require('../helpers/setupPromises')
const setupMongoose = require('../helpers/setupMongoose')
const { Chat } = require('../models')

// Create bot
const bot = new Telegraf(process.env.TOKEN, {
  username: process.env.USERNAME,
  channelMode: true,
})
// Setup promises
setupPromises()
// Setup mongoose
setupMongoose()

async function sendout() {
  const chatsCount = await Chat.count({})
  console.log(chatsCount)
  process.exit(1)
}

sendout()
