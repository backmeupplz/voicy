// Dependencies
const fs = require('fs')
const https = require('https')
const language = require('./language')
const cloud = require('./cloud')
const ffmpeg = require('fluent-ffmpeg')
const temp = require('temp')

// Language map
const languageMap = {
  'ru-RU': 'Russian',
  'en-US': 'English',
  'tr-TR': 'Turkish',
  'uk-UK': 'Ukrainian',
}

/**
 * Function that converts url with audio file into text
 * @param {Path} flacPath Flac path of the audio file to convert
 * @param {Mongoose:Chat} Chat where audio was fetched
 * @param {Int} duration Duration of audio file
 * @return {String} Result text
 */
async function getText(flacPath, chat, duration, ogaPath) {
  if (chat.engine === 'wit') {
    return wit(language.witLanguages()[chat.witLanguage], ogaPath, duration)
  } else if (chat.engine === 'google') {
    return google(flacPath, chat)
  }
  // Try wit if yandex couldn't make it
  const yandexResult = await yandex(flacPath, chat)
  if (!yandexResult) {
    return wit(
      language.witLanguages()[languageMap[chat.yandexLanguage]],
      ogaPath,
      duration
    )
  }
  return yandexResult
}

/**
 * Convert filepath to text with google
 * @param {Path} filePath Path of the file
 * @param {Mongoose:Chat} chat Chat to convert
 */
async function google(filePath, chat) {
  // Check if chat has google credentials
  if (!chat.googleKey) {
    throw new Error('No google credentials')
  }
  // Upload to drive
  const uri = await cloud.put(filePath, chat)
  // Transcribe
  const speech = require('@google-cloud/speech')({
    credentials: JSON.parse(chat.googleKey),
  })

  return new Promise(resolve => {
    speech.startRecognition(
      uri,
      {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: chat.googleLanguage,
      },
      async (err, operation) => {
        if (err) {
          resolve()
          try {
            await cloud.del(uri, chat)
          } catch (err) {
            // Do nothing
          }
          return
        }
        operation
          .on('error', async () => {
            resolve()
            try {
              await cloud.del(uri, chat)
            } catch (err) {
              // Do nothing
            }
          })
          .on('complete', async result => {
            resolve(result)
            try {
              await cloud.del(uri, chat)
            } catch (err) {
              // Do nothing
            }
          })
      }
    )
  })
}

/**
 * Converting audio to text with wit
 * @param {String} token Token of the wit.ai language
 * @param {Path} filePath Path of the file to convert
 */
async function wit(token, filePath, duration) {
  const paths = await splitPath(filePath, duration)
  const promises = []
  for (const path of paths) {
    promises.push(
      new Promise(resolve => {
        const options = {
          method: 'POST',
          hostname: 'api.wit.ai',
          port: null,
          path: '/speech?v=20170307',
          headers: {
            authorization: `Bearer ${token}`,
            'content-type':
              'audio/raw;encoding=signed-integer;bits=16;rate=16000;endian=little',
            'cache-control': 'no-cache',
          },
        }
        const req = https.request(options, res => {
          const chunks = []

          res.on('data', chunk => {
            chunks.push(chunk)
          })

          res.on('end', () => {
            const body = Buffer.concat(chunks)
            try {
              resolve(JSON.parse(body.toString())._text)
            } catch (err) {
              // Do nothing
            }
          })

          res.on('error', () => {
            try {
              resolve('')
            } catch (err) {
              // Do nothing
            }
          })
        })

        req.on('error', () => {
          try {
            resolve('')
          } catch (err) {
            // Do nothing
          }
        })

        const stream = fs.createReadStream(path)
        stream.pipe(req)
        let error
        stream.on('error', err => {
          error = err
        })
        stream.on('close', () => {
          if (error) {
            try {
              resolve('')
            } catch (err) {
              // Do nothing
            }
          }
        })
      })
    )
  }
  try {
    const responses = await Promise.all(promises)
    return responses.join(' ').trim()
  } catch (err) {
    throw err
  } finally {
    for (const path of paths) {
      tryDeletingFile(path)
    }
  }
}

function splitPath(path, duration) {
  const trackLength = 50
  const lastTrackLength = duration % trackLength

  const promises = []
  for (let i = 0; i < duration; i += trackLength) {
    const output = temp.path({ suffix: '.flac' })
    promises.push(
      new Promise((res, rej) => {
        ffmpeg()
          .input(path)
          .on('error', error => {
            rej(error)
          })
          .on('end', () => res(output))
          .output(output)
          .setStartTime(i)
          .duration(i + trackLength < duration ? trackLength : lastTrackLength)
          .audioFrequency(16000)
          .toFormat('s16le')
          .run()
      })
    )
  }
  return Promise.all(promises)
}

/**
 * Function to convert audio to text with Yandex
 * @param {Path} filePath Path of the file to convert
 * @param {Mongoose:Chat} chat Relevant chat
 */
function yandex(filePath, chat) {
  return new Promise(resolve => {
    const exec = require('child_process').exec
    const args = `asrclient-cli.py --key=${process.env.YANDEX_KEY} --lang=${
      chat.yandexLanguage
    } --silent ${filePath}`

    exec(args, (error, stdout) => {
      if (error) {
        resolve()
      }
      const result = stdout
        .replace(/from .+ to .+/g, '')
        .replace(/(^[ \t]*\n)/gm, '')
        .split('\n')
        .join(' ')
        .trim()
      resolve(result)
    })
  })
}

function tryDeletingFile(path) {
  try {
    fs.unlinkSync(path)
  } catch (err) {
    // do nothing
  }
}

// Exports
module.exports = {
  getText,
}
