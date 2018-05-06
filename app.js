/**
 * Main app logic
 *
 * @module app
 * @license MIT
 */

/** Load env variables */
require('dotenv').config({path: `${__dirname}/.env`});

/** Dependencies */
const bot = require('./helpers/bot');
const voice = require('./helpers/voice');
const mongoose = require('mongoose');
const config = require('./config');
const help = require('./helpers/help');
const start = require('./helpers/start');
const language = require('./helpers/language');
const engine = require('./helpers/engine');
const balance = require('./helpers/balance');
const db = require('./helpers/db');
const sendout = require('./helpers/sendout');
const producthunt = require('./helpers/producthunt');
const admins = require('./helpers/admins');
const lock = require('./helpers/lock');
const files = require('./helpers/files');
const silent = require('./helpers/silent');
const payments = require('./helpers/payments');
const botan = require('botanio')(config.botan_token);

global.Promise = require('bluebird');

global.Promise.config({ cancellation: true });

/** Setup mongoose */
mongoose.Promise = global.Promise;
mongoose.connect(config.database, {
  server: {
    socketOptions: {
      socketTimeoutMS: 10000,
      connectTimeoutMS: 50000,
    },
  },
});
mongoose.connection.on('disconnected', () => {
  mongoose.connect(config.database, {
    server: {
      socketOptions: {
        socketTimeoutMS: 10000,
        connectTimeoutMS: 10000,
      },
    },
  });
});

bot.on('channel_post', (msg) => {
  handle(msg);
});

bot.on('pre_checkout_query', (msg) => {
  payments.handlePreChekoutQuery(bot, msg);
});

bot.on('message', (msg) => {
  handle(msg);
  analytics(msg);
});

function analytics(msg) {
  if (msg.entities && msg.entities[0] && msg.entities[0].type === 'bot_command') {
    const commandList = ['help', 'balance', 'start producthunt', 'start', 'engine', 'language', 'lock', 'files', 'silent'];
    for (let i in commandList) {
      const command = commandList[i];
      if (msg.text.includes(command)) {
        botan.track(msg, command);
        return;
      }
    }
  } else {
    botan.track(msg, 'message');
  }
}

/**
 * Used to handle incoming message
 * @param {Telegram:Message} msg Message received
 */
function handle(msg) {
  if (!msg) {
    return;
  }
  if (msg.text) {
    if (msg.text.includes('@') && !msg.text.includes('@voicybot')) {
      return;
    }
  }
  if (msg.pre_checkout_query) {
    payments.handlePreChekoutQuery(bot, msg);
    return;
  }
  if (msg.successful_payment) {
    payments.handleSuccess(bot, msg);
    return;
  }
  if (msg.date && msg.date < (Math.floor(Date.now() / 1000) - 120)) {
    return;
  }
  const isPrivateChat = msg.chat.type === 'private' || msg.chat.type === 'channel';
  const isVoice = (msg.voice);
  const isDocument = (msg.document);
  const isOpus = isDocument && (msg.document.mime_type === 'application/octet-stream' || (msg.document.file_name && msg.document.file_name.split('.').pop() === 'opus'));
  const isWav = isDocument && (msg.document.mime_type === 'audio/x-wav');
  const isOgg = isDocument && (msg.document.mime_type === 'application/ogg');
  const isDocumentAudio = isDocument && msg.document.mime_type && (msg.document.mime_type.includes('audio'));
  const isAudio = (msg.audio);
  const isMpeg = isAudio && (msg.audio.mime_type === 'audio/mpeg');
  const isFlac = isAudio && (msg.audio.mime_type === 'audio/flac');
  const isMp3 = isAudio && (msg.audio.mime_type === 'audio/mp3');
  const isMp4 = isAudio && (msg.audio.mime_type === 'audio/mp4');
  const isAudioOgg = isAudio && (msg.audio.mime_type === 'audio/x-vorbis+ogg');
  const isVideoNote = msg.video_note;

  if (isVoice || isDocument || isAudio) {
    db.findChat(msg.chat.id)
      .then((chat) => {
        if (isOpus || isWav || isOgg || isMpeg || isFlac || isMp3 || isMp4 ||
          isAudioOgg || isDocumentAudio) {
          if (!chat.filesBanned) {
            voice.handleMessage(bot, msg, chat);
          }
        } else if (isVoice) {
          voice.handleMessage(bot, msg, chat);
        }
      })
      .catch(/** todo: handle error */);
  /** Get video note */
  } else if (isVideoNote) {
    db.findChat(msg.chat.id)
      .then((chat) => {
        if (!chat.videoNotesBanned) {
          voice.handleMessage(bot, msg, chat);
        }
      })
      .catch(/** todo: handle error */);
  /** Get command from private chat or group chat with adminLock false */
  } else if (msg.text && msg.entities && msg.entities[0] && msg.entities[0].type === 'bot_command') {
    db.findChat(msg.chat.id)
      .then((chat) => {
        if (!chat.adminLocked || isPrivateChat) {
          /** Check if godvoice */
          if (msg.text.includes('godvoice') && chat.id === '76104711') {
            const text = msg.text.slice(10, msg.text.length);
            sendout.sendAll(bot, text);
          /** Check if help */
          } else if (msg.text.includes('help')) {
            help.sendHelp(bot, chat, isPrivateChat);
          /** Check if balance */
          } else if (msg.text.includes('balance')) {
            balance.sendBalance(bot, chat);
          /** Check if start */
          } else if (msg.text === '/start' || msg.text === '/start producthunt' || msg.text === '/start@voicybot' || msg.text === '/start@voicybot producthunt') {
            if (msg.from.language_code) {
              const codes = language.setLanguageCode(chat, msg.from.language_code);
              chat.witLanguage = codes.wit;
              chat.googleLanguage = codes.google;
              chat.yandexLanguage = codes.yandex;
              start.sendStart(bot, chat);
              if (msg.text.includes('producthunt')) {
                producthunt.applyDiscount(bot, chat, msg);
              }
            } else {
              language.sendLanguage(bot, chat);
              if (msg.text.includes('producthunt')) {
                producthunt.applyDiscount(bot, chat, msg);
              }
            }
          /** Check if payment request */
          } else if (msg.text.includes('/start')) {
            if (msg.from.language_code) {
              const codes = language.setLanguageCode(chat, msg.from.language_code);
              chat.witLanguage = codes.wit;
              chat.googleLanguage = codes.google;
              chat.yandexLanguage = codes.yandex;
            }
            const id = parseInt(msg.text.split(' ')[1], 10);
            if (id && isPrivateChat) {
              payments.sendPaymentRequest(bot, chat, id);
            }
          /** Check if engine */
          } else if (msg.text.includes('engine')) {
            engine.sendEngine(bot, chat);
          /** Check if language */
          } else if (msg.text.includes('language')) {
            language.sendLanguage(bot, chat, true);
          /** Check if lock */
          } else if (msg.text.includes('lock') && !isPrivateChat) {
            lock.toggle(bot, chat);
          /** Check if files */
          } else if (msg.text.includes('files')) {
            files.toggle(bot, chat);
          /** Check if silent */
          } else if (msg.text.includes('silent')) {
            silent.toggle(bot, chat);
          }
        } else {
          return admins.isAdmin(bot, chat.id, msg.from.id)
            .then((isAdmin) => {
              if (!isAdmin) {
                return;
              }
              /** Check if help */
              if (msg.text.includes('help')) {
                help.sendHelp(bot, chat, isPrivateChat);
              /** Check if balance */
              } else if (msg.text.includes('balance')) {
                balance.sendBalance(bot, chat);
              /** Check if start */
              } else if (msg.text === '/start' || msg.text === '/start producthunt' || msg.text === '/start@voicybot' || msg.text === '/start@voicybot producthunt') {
                if (msg.from.language_code) {
                  const codes = language.setLanguageCode(chat, msg.from.language_code);
                  chat.witLanguage = codes.wit;
                  chat.googleLanguage = codes.google;
                  chat.yandexLanguage = codes.yandex;
                  start.sendStart(bot, chat);
                  if (msg.text.includes('producthunt')) {
                    producthunt.applyDiscount(bot, chat, msg);
                  }
                } else {
                  language.sendLanguage(bot, chat);
                  if (msg.text.includes('producthunt')) {
                    producthunt.applyDiscount(bot, chat, msg);
                  }
                }
              /** Check if engine */
              } else if (msg.text.includes('engine')) {
                engine.sendEngine(bot, chat);
              /** Check if language */
              } else if (msg.text.includes('language')) {
                language.sendLanguage(bot, chat, true);
              /** Check if lock */
              } else if (msg.text.includes('lock')) {
                lock.toggle(bot, chat);
              /** Check if files */
              } else if (msg.text.includes('files')) {
                files.toggle(bot, chat);
              /** Check if silent */
              } else if (msg.text.includes('silent')) {
                silent.toggle(bot, chat);
              }
            });
        }
      })
      .catch(/** todo: handle error */);
  } else if (msg.new_chat_participant && msg.new_chat_participant.username === 'voicybot') {
    db.findChat(msg.chat.id)
      .then((chat) => {
        language.sendLanguage(bot, chat);
      })
      .catch(/** todo: handle error */);
  }
}

bot.on('callback_query', (msg) => {
  const options = msg.data.split('~');
  const inline = options[0];
  if (inline === 'li') {
    language.setLanguage(bot, msg);
  } else if (inline === 'ei') {
    engine.setEngine(bot, msg);
  } else if (inline === 'pi') {
    payments.sendInvoice(bot, msg);
  }
});

/** Used to check localizations */
// const str = require('./helpers/strings')();
// const translations = str.getTranslations();
// str.setLocale('it');
// function check() {
//   // const i = '😎 *Voicy* converts speech to text from any voice messages and audio files (.ogg, .flac, .wav, .mp3) it receives. You can either talk to *Voicy* in the private chat or add it to a group.\n\n/help — Shows this message 😱\n/engine — Lets you pick a voice recognition engine: wit.ai (free), Yandex SpeechKit (free) or Google Speech (not free) ⚙\n/language — Lets you pick a voice recognition language 📣\n/balance — Shows how many Google Speech voice recognition seconds are left for this chat 🎉\n/lock — Toggles lock or unlock of non-admins using commands 🔑\n/files — Toggles if the bot should attempt to convert audio files or just ignore them 📁\n/silent — Toggles silent mode when no extra messages like `Voice recognition is initiated` are sent 😶\n\nLike this bot? Leave a review here: https://telegram.me/storebot?start=voicybot\n\nAddress any concerns and questions to my creator — @borodutch 🦄';
//   // bot.sendMessage('76104711', str.translate(i, 999, 2000), {
//   //   parse_mode: 'Markdown',
//   //   disable_web_page_preview: true,
//   // });
//   Object.keys(translations).forEach((key) => {
//     bot.sendMessage('76104711', str.translate(key, 9999, 10000), {
//       parse_mode: 'Markdown',
//       disable_web_page_preview: true,
//     })
//     .catch(err => console.log(key, err.message));
//   });
// }
// check();

console.info('Bot is up and running');
