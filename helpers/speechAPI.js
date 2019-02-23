// Dependencies
const fs = require('fs')
const https = require('https')
const { witLanguages } = require('./language/languageConstants')
const cloud = require('./cloud')
const ffmpeg = require('fluent-ffmpeg')
const temp = require('temp')
const tryDeletingFile = require('./deleteFile')

/**
 * Function that converts url with audio file into text
 * @param {Path} flacPath Flac path of the audio file to convert
 * @param {Mongoose:Chat} Chat where audio was fetched
 * @param {Int} duration Duration of audio file
 * @return {String} Result text
 */
async function getText(flacPath, chat, duration, ogaPath) {
  return chat.engine === 'wit'
    ? wit(witLanguages()[chat.witLanguage], ogaPath, duration, chat.witLanguage)
    : google(flacPath, chat)
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
          } catch (error) {
            // Do nothing
          }
          return
        }
        operation
          .on('error', async () => {
            resolve()
            try {
              await cloud.del(uri, chat)
            } catch (error) {
              // Do nothing
            }
          })
          .on('complete', async result => {
            resolve(result)
            try {
              await cloud.del(uri, chat)
            } catch (error) {
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
async function wit(token, filePath, duration, iLanguage) {
  const paths = await splitPath(filePath, duration)
  let result = []
  while (paths.length) {
    const pathsToRecognize = paths.splice(0, 5)
    const promises = []
    for (const path of pathsToRecognize) {
      promises.push(
        new Promise(async (res, rej) => {
          let triesCount = 10
          let error
          while (triesCount > 0) {
            try {
              const text = await recognizePath(path, token)
              res(text)
              return
            } catch (err) {
              error = err
              triesCount -= 1
              console.info(
                `Retrying ${iLanguage} ${path}, attempts left — ${triesCount}, error: ${
                  err.message
                } (${err.code})`
              )
            }
          }
          rej(error)
        })
      )
    }
    try {
      const responses = await Promise.all(promises)
      result = result.concat(responses.map(r => (r || '').trim()))
    } catch (err) {
      throw err
    } finally {
      for (const path of pathsToRecognize) {
        tryDeletingFile(path)
      }
    }
  }
  return result.join('. ').trim()
}

function splitPath(path, duration) {
  const trackLength = duration > 50 ? 30 : 50
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

async function recognizePath(path, token) {
  return new Promise((resolve, reject) => {
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
        try {
          const body = Buffer.concat(chunks)
          const json = JSON.parse(body.toString())
          if (json.error) {
            const error = new Error(json.error)
            error.code = json.code
            try {
              reject(error)
            } catch (err) {
              // Do nothing
            }
          } else {
            try {
              resolve(json._text)
            } catch (err) {
              // Do nothing
            }
          }
        } catch (err) {
          try {
            reject(err)
          } catch (error) {
            // Do nothing
          }
        }
      })

      res.on('error', err => {
        try {
          reject(err)
        } catch (error) {
          // Do nothing
        }
      })
    })

    req.on('error', err => {
      try {
        reject(err)
      } catch (error) {
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
          reject(error)
        } catch (err) {
          // Do nothing
        }
      }
    })
  })
}

// Exports
module.exports = {
  getText,
}
