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
  for (let i = 0; i < chatsCount; i += 30) {
    console.log(`Sending message to ${i}`)
    const chats = Chat.find({})
      .offset(i)
      .limit(30)
    for (const chat of chats) {
      const strings = require('../helpers/strings')()
      strings.setChat(chat)
      const text = strings.translate('sendout')
      console.log(text)
    }
    await delay(1)
  }
}

function delay(s) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve()
    }, s * 1000)
  })
}

sendout()
