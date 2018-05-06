/**
 * Voice messages manager
 *
 * @module url
 * @license MIT
 */

/** Dependencies */
const urlFinder = require('./url');
const speechAPI = require('./speechAPI');
const db = require('./db');
const download = require('download');
const temp = require('temp');
const fs = require('fs');
const flac = require('./flac');

/**
 * Handles any message that comes with voice
 * @param {Telegram:Bot} bot Bot that should respond
 * @param {Telegram:Message} msg Message that was received
 * @param {Mongoose:Chat} chat Chat object where message has been received
 */
async function handleMessage(bot, msg, chat) {
  /** Prepare strings */
  const strings = require('./strings')();
  strings.setChat(chat);

  /** Get voice message */
  const voice = msg.voice || msg.document || msg.audio || msg.video_note;

  /** Send an error to user if file is larger than 20 mb */
  if (voice.file_size && voice.file_size >= 19 * 1024 * 1024) {
    bot.sendMessage(msg.chat.id, strings.translate('_👮 I can\'t recognize voice messages larger than 20 megabytes_'), {
      parse_mode: 'Markdown',
      reply_to_message_id: msg.message_id,
    });
    return;
  }

  /** Get full url to the voice message */
  const fileData = await bot.getFile(voice.file_id);
  const voiceUrl = await urlFinder.fileUrl(fileData.file_path);

  /** Send action or transcription depending on whether chat is silent */
  if (chat.silent) {
    await sendAction(bot, msg, voiceUrl, chat);
  } else {
    await sendTranscription(bot, msg, voiceUrl, chat);
  }
}

/**
 * Sends temp message first and then updates that message to the transcription or error
 * @param {Telegram:Bot} bot Bot that should send transcription
 * @param {Telegram:Message} msg Message that triggered voice recognition
 * @param {URL} url Url of audio file to transcript
 * @param {Mongoose:Chat} chat Chat object where message has been received
 */
async function sendTranscription(bot, msg, url, chat) {
  /** Prepare strings */
  const strings = require('./strings')();
  strings.setChat(chat);

  /** Send initial message */
  const sentMessage = await bot.sendMessage(msg.chat.id, strings.translate('_🦄 Voice recognition is initiated..._'), {
    parse_mode: 'Markdown',
    reply_to_message_id: msg.message_id,
  });

  /** Try to find existing voice message */
  let lan;
  if (chat.engine === 'google') {
    lan = chat.googleLanguage;
  } else if (chat.engine === 'wit') {
    lan = chat.witLanguage;
  } else {
    lan = chat.yandexLanguage;
  }
  const dbvoice = await db.findVoice(url, lan, chat.engine);
  if (dbvoice && lan === dbvoice.language && dbvoice.engine === chat.engine) {
    updateMessagewithTranscription(bot, sentMessage, dbvoice.text, chat);
    return;
  }

  /** Download audio file */
  const ogaPath = temp.path({ suffix: '.oga' });
  try {
    const data = await download(url);
    fs.writeFileSync(ogaPath, data);
  } catch (err) {
    updateMessagewithError(bot, sentMessage, `download error: ${err.message}`, chat);
    return;
  }

  /** Convert audio file to flac */
  let flacPath;
  let duration;
  try {
    const result = await flac(ogaPath, chat);
    flacPath = result.flacPath;
    duration = result.duration;
  } catch (err) {
    updateMessagewithError(bot, sentMessage, `flac converter error: ${err.message}`, chat);
    return;
  }

  /** Check if ok with google engine */
  if (chat.engine === 'google' && (chat.seconds <= 0 || (chat.seconds + 10 < duration))) {
    /** Send message warning about switch to wit.ai */
    const text = strings.translate('😮 You didn\'t have enough seconds of Google Speech voice recognition left to convert this voice message! But no worries — we have automatically switched you to the free wit.ai so that no voice messages are getting lost. Don\'t forget to setup your /language.');
    await bot.sendMessage(chat.id, text, {
      parse_mode: 'Markdown',
    });
    /** Set wit.ai to be the new chat's engine */
    chat.engine = 'wit';
    await chat.save();
  }

  /** Check limits */
  if (chat.engine === 'wit' && duration > 50) {
    updateMessagewithTranscription(bot, sentMessage, strings.translate('_👮 Wit.ai cannot recognize voice messages longer than 50 seconds_'), chat, true);
    /** Unlink files */
    fs.unlink(flacPath);
    fs.unlink(ogaPath);
    return;
  }

  /** No need for oga file anymore */
  fs.unlink(ogaPath);

  /** Convert flac file to speech */
  try {
    /** Get transcription */
    const text = await speechAPI.getText(flacPath, chat, duration);
    /** Save voice to db */
    db.addVoice(url, text, chat, duration, bot);
    /** Unlink flac file */
    fs.unlink(flacPath);
    /** Send trancription to user */
    updateMessagewithTranscription(bot, sentMessage, text, chat);
  } catch (err) {
    updateMessagewithError(bot, sentMessage, `text to speech error: (${chat.engine}) ${err.message}`, chat);
  }
}

/**
 * Sends typing action first and then sends transcription (doesn't send error)
 * @param {Telegram:Bot} bot Bot that should send transcription
 * @param {Telegram:Message} msg Message that triggered voice recognition
 * @param {URL} url Url of audio file to transcript
 * @param {Mongoose:Chat} chat Chat object where message has been received
 */
async function sendAction(bot, msg, url, chat) {
  /** Prepare strings */
  const strings = require('./strings')();
  strings.setChat(chat);

  /** Send typing action */
  bot.sendChatAction(msg.chat.id, 'typing');

  /** Try to find existing voice message */
  let lan;
  if (chat.engine === 'google') {
    lan = chat.googleLanguage;
  } else if (chat.engine === 'wit') {
    lan = chat.witLanguage;
  } else {
    lan = chat.yandexLanguage;
  }
  const dbvoice = await db.findVoice(url, lan, chat.engine);
  if (dbvoice && lan === dbvoice.language && dbvoice.engine === chat.engine) {
    sendMessageWithTranscription(bot, msg, dbvoice.text, chat);
    return;
  }

  /** Download audio file */
  const ogaPath = temp.path({ suffix: '.oga' });
  const data = await download(url);
  fs.writeFileSync(ogaPath, data);

  /** Convert audio file to flac */
  const { flacPath, duration } = await flac(ogaPath, chat);

  /** Check if ok with google engine */
  if (chat.engine === 'google' && (chat.seconds <= 0 || (chat.seconds + 10 < duration))) {
    /** Set wit.ai to be the new chat's engine */
    chat.engine = 'wit';
    await chat.save();
  }

  /** Check limits */
  if (chat.engine === 'wit' && duration > 50) {
    /** Unlink files */
    fs.unlink(flacPath);
    fs.unlink(ogaPath);
    return;
  }

  /** No need for oga file anymore */
  fs.unlink(ogaPath);

  /** Convert flac file to speech */
  const text = await speechAPI.getText(flacPath, chat, duration);

  /** Save voice to db */
  db.addVoice(url, text, chat, duration, bot);

  /** Unlink flac file */
  fs.unlink(flacPath);

  /** Send trancription to user */
  sendMessageWithTranscription(bot, msg, text, chat);
}

function updateMessagewithTranscription(bot, msg, text, chat, markdown) {
  const strings = require('./strings')();

  const options = {
    chat_id: msg.chat.id,
    message_id: msg.message_id,
  };
  if (!text || markdown) {
    options.parse_mode = 'Markdown';
  }
  strings.setChat(chat);

  bot.editMessageText(text || strings.translate('_👮 Please, speak clearly, I couldn\'t recognize that_'), options);
}

function sendMessageWithTranscription(bot, msg, text, chat, markdown) {
  const strings = require('./strings')();
  const options = {
    reply_to_message_id: msg.message_id,
  };
  if (!text || markdown) {
    options.parse_mode = 'Markdown';
  }

  strings.setChat(chat);

  if (text) {
    return bot.sendMessage(chat.id, text, options);
  }
}

function updateMessagewithError(bot, msg, error, chat) {
  const strings = require('./strings')();
  strings.setChat(chat);

  bot.editMessageText(strings.translate('_👮 I couldn\'t recognize that_'), {
    chat_id: msg.chat.id,
    message_id: msg.message_id,
    parse_mode: 'Markdown',
  });
}

/** Exports */

module.exports = {
  handleMessage,
};
