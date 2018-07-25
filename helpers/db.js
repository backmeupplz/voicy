// Get schemas
const {
  // Voice,
  Chat,
} = require('../models')

/**
 * Searches for chat by it's id, creates new chat if doesn't exist yet
 * @param {Telegram:ChatId} id Id of the chat to search
 * @returns Chat with the specified id
 */
async function findChat(id) {
  let chat = await Chat.findOne({ id })
  if (!chat) {
    chat = new Chat({ id })
    chat = await chat.save()
  }
  return chat
}

// /**
//  * Adds a voice to the database
//  * @param {URL} url Url of the audio file
//  * @param {String} text Transcription in text
//  * @param {Mongoose:Chat} chat Chat where audio was recognized
//  * @param {Int} duration Duration of this voice message
//  * @param {Telegram:Bot} bot Bot that should ask for payments if needed
//  */
// function addVoice(url, text, chat, duration, bot) {
//   let language;
//   if (chat.engine === 'wit') {
//     language = chat.witLanguage;
//   } else if (chat.engine === 'google') {
//     language = chat.googleLanguage;
//   } else {
//     language = chat.yandexLanguage;
//   }
//   const voice = new Voice({ url, text, language, duration, engine: chat.engine });
//   return voice.save()
//     .then((dbvoice) => {
//       chat.voices.push(dbvoice);
//       if (chat.engine === 'google') {
//         chat.seconds -= parseInt(duration, 10);
//         if (chat.seconds < 0) {
//           chat.seconds = 0;
//         }
//         if (chat.seconds === 0) {
//           balance.askForPayment(bot, chat);
//           chat.engine = 'wit';
//         }
//       }
//       chat.save();
//       return dbvoice;
//     });
// }

// /**
//  * Searches for voice in database
//  * @param {URL} url Url of the audio file
//  * @param {String} language Language of the audio file
//  * @param {String} engine Engine of the audio file
//  * @returns {Promise} Promise with either found text or null
//  */
// function findVoice(url, language, engine) {
//   return Voice.findOne({ url, language, engine });
// }

// function findOptionalChat(id) {
//   return Chat.findOne({ id });
// }

// function getChats(query) {
//   return Chat.find(query);
// }

// function countChats(query) {
//   return new Promise((resolve, reject) => {
//     Chat.count(query, (err, count) => {
//       if (err) {
//         reject(err);
//       } else {
//         resolve(count);
//       }
//     });
//   });
// }

// Exports
module.exports = {
  findChat,
  // addVoice,
  // findVoice,
  // findOptionalChat,
  // getChats,
  // countChats,
}
