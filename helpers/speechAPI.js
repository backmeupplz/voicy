/**
 * Converts speech to text
 *
 * @module speechAPI
 * @license MIT
 */

/** Dependencies */
const fs = require('fs');
const cloud = require('./cloud');
const https = require('https');
const request = require('request');
const language = require('./language');
const parseString = require('xml2js').parseString;
const config = require('../config');

const languageMap = {
  'ru-RU': 'Russian',
  'en-US': 'English',
  'tr-TR': 'Turkish',
  'uk-UK': 'Ukrainian',
};

/**
 * Function that converts url with audio file into text
 * @param {Path} flacPath Flac path of the audio file to convert
 * @param {Mongoose:Chat} Chat where audio was fetched
 * @param {Int} duration Duration of audio file
 * @return {Promise} Promise with result text or error
 */
async function getText(flacPath, chat, duration) {
  if (chat.engine === 'wit') {
    return await wit(language.witLanguages()[chat.witLanguage], flacPath);
  } else if (chat.engine === 'google') {
    return await google(flacPath, duration, chat);
  }
  // Try wit if yandex couldn't make it
  const yandexResult = await yandex(flacPath, chat);
  if (!yandexResult && duration <= 50) {
    return await wit(language.witLanguages()[languageMap[chat.yandexLanguage]], flacPath);
  }
  return yandexResult;
}

async function google(filePath, duration, chat) {
  const uri = await cloud.put(filePath);
  const speech = require('@google-cloud/speech')({
    projectId: config.g_cloud_project_id,
    credentials: require('../certificates/voicy.json'),
  });

  return new Promise((resolve) => {
    speech.startRecognition(uri, {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode: chat.googleLanguage,
    }, (err, operation) => {
      cloud.del(uri);
      if (err) {
        resolve();
        return;
      }
      operation
        .on('error', () => {
          resolve();
        })
        .on('complete', (result) => {
          resolve(result);
        });
    });
  });
}

function wit(token, filePath) {
  return new Promise((resolve) => {
    const options = {
      method: 'POST',
      hostname: 'api.wit.ai',
      port: null,
      path: '/speech?v=20170307',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'audio/raw;encoding=signed-integer;bits=16;rate=16000;endian=little',
        'cache-control': 'no-cache',
      },
    };
    const req = https.request(options, (res) => {
      const chunks = [];

      res.on('data', (chunk) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        const body = Buffer.concat(chunks);
        resolve(JSON.parse(body.toString())._text);
      });
    });

    fs.createReadStream(filePath).pipe(req);
  });
}

function yandex(filePath, chat) {
  return new Promise((resolve) => {
    const exec = require('child_process').exec;
    const args = `asrclient-cli.py --key=${config.yandex_key} --lang=${chat.yandexLanguage} --silent ${filePath}`;

    exec(args, (error, stdout) => {
      if (error) {
        resolve();
      }
      const result = stdout
        .replace(/from .+ to .+/g, '')
        .replace(/(^[ \t]*\n)/gm, '')
        .split('\n')
        .join(' ')
        .trim();
      resolve(result);
    });
  });
}

/** Exports */
module.exports = {
  getText,
};
