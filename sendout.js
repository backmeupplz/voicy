// Load env variables
require('dotenv').config({ path: `${__dirname}/.env` })
// Init
const setupPromises = require('./init/setupPromises')
const setupMongoose = require('./init/setupMongoose')
// Dependencies
const { Chat } = require('./models')
const { bot } = require('./init/bot')

setupPromises()
setupMongoose()

const message = ``

;(async function run() {
  console.log('Getting chats count...')
  const ruChatsCount = await Chat.find({ $or: [
    { googleLanguage: 'ru-RU' },
    { witLanguage: 'Russian' },
  ] }).count();
  console.log(`Got ${ruChatsCount} chats.`)
  console.log('Getting chats...')
  const ruChats = await Chat.find({ $or: [
    { googleLanguage: 'ru-RU' },
    { witLanguage: 'Russian' },
  ] }, 'id');
  console.log('Got the chats, sending...')
  let successes = 14438;
  for (let i = 34100; i < ruChatsCount; i += 30) {
    const chatsToSend = ruChats.slice(i, i + 30)
    let j = 0
    const promises = [];
    for (const chat of chatsToSend) {
      promises.push(new Promise(async (res) => {
        console.log(`(${i + j++}/${ruChatsCount} — ${successes}) Sending message to ${chat.id}`)
        try {
          await bot.telegram.sendMessage(chat.id, message, {
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          })
          res(1)
        } catch (err) {
          console.log(chat.id, err.message)
          res(0)
        }
      }));
    }
    successes += (await Promise.all(promises)).reduce((p, c) => p + c, 0)
    await delay(1)
  }
  console.log(`All done! ${successes} chats received message`)
  process.exit(0)
})()

function delay(seconds) {
  return new Promise(res => {
    setTimeout(() => {
      res()
    }, seconds * 1000);
  })
}