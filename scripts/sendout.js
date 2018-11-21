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
  let chatsAllowed = 0
  const chatsCount = await Chat.count({})
  for (let i = 0; i < chatsCount; i += 30) {
    console.log(`Sending message to ${i}`)
    const chats = await Chat.find({})
      .skip(i)
      .limit(30)
    for (const chat of chats) {
      console.log(`(${i}/${chatsAllowed}/${chatsCount}) Sending to ${chat.id}`)
      const strings = require('../helpers/strings')()
      strings.setChat(chat)
      let text
      try {
        text = strings.translate(
          'Hi there! Just wanted to let you know that we will no longer annoy you with sending messages on behalf of @voicybot because we have created a special channel — @borodutch_support — where we will post the most important updates about the @voicybot (i.e. if anything is broken, check there first). Thank you a lot for using @voicybot. Cheers!'
        )
      } catch {
        strings.setLocale('en')
        text = strings.translate(
          'Hi there! Just wanted to let you know that we will no longer annoy you with sending messages on behalf of @voicybot because we have created a special channel — @borodutch_support — where we will post the most important updates about the @voicybot (i.e. if anything is broken, check there first). Thank you a lot for using @voicybot. Cheers!'
        )
      }
      try {
        bot.sendMessage(chat.id, text)
        chatsAllowed++
      } catch {
        // Do nothing
      }
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
