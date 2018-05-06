/**
 * File to sendout messages per languages
 */

/** Load env variables */
require('dotenv').config({path: `${__dirname}/.env`});

/** Dependencies */
const mongoose = require('mongoose');

mongoose.Promise = global.Promise;
mongoose.connect(process.env.VOICY_MONGO_DB_URL, {
  server: {
    socketOptions: {
      socketTimeoutMS: 0,
      connectTimeoutMS: 0,
    },
  },
});
mongoose.connection.on('disconnected', () => {
  mongoose.connect(config.database, {
    server: {
      socketOptions: {
        connectTimeoutMS: 0,
      },
    },
  });
});

const db = require('./helpers/db');
const Telegram = require('node-telegram-bot-api');
const config = require('./config');

const bot = new Telegram(process.env.VOICY_TELEGRAM_API_KEY, {
  polling: false,
});

const msg = {
  'ru': 'Привет всем! Огромное спасибо за то, что пользуетесь бесплатным @voicybot. !',
};

const languages = {
  'wit': {
    'Russian': 'ru',
  },
  'google': {
    'ru-RU': 'ru',
  },
  'yandex': {
    'ru-RU': 'ru',
  },
};

function getLanguage(chat) {
  let lan = 'en';
  Object.keys(languages).forEach((engine) => {
    if (engine === chat.engine) {
      const object = languages[engine];
      let chatLanguage;
      if (engine === 'wit') {
        chatLanguage = chat.witLanguage;
      } else if (engine === 'google') {
        chatLanguage = chat.googleLanguage;
      } else {
        chatLanguage = chat.yandexLanguage;
      }
      const lang = object[chatLanguage] || 'en';
      lan = lang;
    }
  });
  return lan;
}

function send(message, total, index, successes) {
  if (index > total) {
    console.log(`All sent! Successes:\n${JSON.stringify(successes)}`);
    return;
  }
  db.getChats({ $or: [
    { witLanguage: 'Russian' },
    { googleLanguage: 'ru-RU' },
    { yandexLanguage: 'ru-RU' },
  ]})
    .skip(index)
    .limit(30)
    .then((chats) => {
      const promises = [];
      chats.forEach((chat) => {
        console.log(`(${index}) sent to ${chat.id}`);
        const p = new Promise((resolve, reject) => {
          bot.sendMessage(chat.id, message)
            .then(() => resolve(1))
            .catch((err) => {
              console.error(`${chat.id}: ${err.message}`);
              resolve(0);
            });
        });
        promises.push(p);
      });
      return Promise.all(promises)
        .then((results) => {
          return results.reduce((prev, cur) => prev + cur, 0);
        })
        .then((count) => {
          console.log(`${index + 30}/${total}`);
          setTimeout(() => {
            send(message, total, index + 30, successes + count);
          }, 1500);
        })
        .catch(err => console.error(err));
    })
    .catch(err => console.error(err));
}

function sendMessages(message) {
  console.log('Getting chats count...');
  db.countChats({ $or: [
    { witLanguage: 'Russian' },
    { googleLanguage: 'ru-RU' },
    { yandexLanguage: 'ru-RU' },
  ]})
    .then((c) => {
      console.log(`Found ${c} chats. Sending the message...`);
      send(message, c, 0, 0);
    })
    .catch(err => console.error(err));
}

console.log('Starting...');
sendMessages('Привет всем! Спасибо за активное использование @voicybot! Более 3.1 миллиона голосовых сообщений было переведено в текст с момента запуска бота — и все это абсолютно бесплатно и всегда будет бесплатным. Поблагодарить авторов бота очень просто: мы начали вести свой канал в Телеграме о путешествиях, политике, критическом мышлении, IT, криптовалютах и проектах, которыми сейчас занимаемся. Будем очень признательны, если вы подпишитесь: @golden_borodutch. Спасибо!');
