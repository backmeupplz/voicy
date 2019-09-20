// Dependencies
const fs = require('fs')
const https = require('https')
const { witLanguages } = require('./language/languageConstants')
const cloud = require('./cloud')
const ffmpeg = require('fluent-ffmpeg')
const temp = require('temp')
const tryDeletingFile = require('./deleteFile')
const axios = require('axios')
const FormData = require('form-data')
const Blob = require('blob-util')

/**
 * Function that converts url with audio file into text
 * @param {Path} flacPath Flac path of the audio file to convert
 * @param {Mongoose:Chat} Chat where audio was fetched
 * @param {Int} duration Duration of audio file
 */
async function getText(flacPath, chat, duration, ogaPath) {
  if (chat.engine === 'wit') {
    return wit(
      witLanguages[chat.witLanguage],
      ogaPath,
      duration,
      chat.witLanguage
    )
  } else if (chat.engine === 'ashmanov') {
    return ashmanov(flacPath, duration)
  } else {
    return google(flacPath, chat, duration)
  }
}

/**
 * Convert filepath to text with google
 * @param {Path} filePath Path of the file
 * @param {Mongoose:Chat} chat Chat to convert
 */
async function google(filePath, chat, duration) {
  // Check if chat has google credentials
  if (!chat.googleKey) {
    throw new Error('No google credentials')
  }
  // Upload to drive
  const uri = await cloud.put(filePath, chat)
  // Transcribe
  const SpeechClient = require('@google-cloud/speech').SpeechClient
  const speech = new SpeechClient({
    credentials: JSON.parse(chat.googleKey),
  })

  const request = {
    config: {
      enableWordTimeOffsets: true,
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode: chat.googleLanguage,
    },
    audio: {
      uri,
    },
  }
  try {
    const [operation] = await speech.longRunningRecognize(request)
    const [response] = await operation.promise()
    const resultingStrings = []
    response.results.forEach(result => {
      if (!result.alternatives[0].words.length) {
        return
      }
      const firstWord = result.alternatives[0].words[0]
      const lastWord =
        result.alternatives[0].words[result.alternatives[0].words.length - 1]
      const startTime = `${firstWord.startTime.seconds}.${firstWord.startTime
        .nanos / 100000000}`
      const endTime = `${lastWord.endTime.seconds}.${lastWord.endTime.nanos /
        100000000}`
      const text = result.alternatives[0].transcript.trim()
      if (text) {
        resultingStrings.push([`${startTime}-${endTime}`, text])
      }
    })
    return resultingStrings
  } catch (err) {
    throw err
  } finally {
    await cloud.del(uri, chat)
  }
}

/**
 * Converting audio to text with wit
 * @param {String} token Token of the wit.ai language
 * @param {Path} filePath Path of the file to convert
 */
async function wit(token, filePath, duration, iLanguage) {
  const paths = await splitPath(filePath, duration)
  const savedPaths = paths.slice()
  try {
    let result = []
    while (paths.length) {
      const pathsToRecognize = paths.splice(0, 5)
      const pathsToDelete = pathsToRecognize.slice()
      const promises = []
      for (const path of pathsToRecognize) {
        promises.push(
          new Promise(async (res, rej) => {
            let triesCount = 5
            let error
            while (triesCount > 0) {
              try {
                const text = await recognizePath(path, token)
                res(text)
                return
              } catch (err) {
                error = err
                triesCount -= 1
                if (
                  err.message.indexOf('Max audio length is 20 seconds') > -1
                ) {
                  break
                }
                console.info(
                  `Retrying ${iLanguage} ${path}, attempts left — ${triesCount}, error: ${err.message} (${err.code})`
                )
              }
            }
            error.message = `${error.message} (${duration}s)`
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
        for (const path of pathsToDelete) {
          tryDeletingFile(path)
        }
      }
    }
    const splitDuration = 15
    return result.length < 2
      ? [[`0-${parseInt(duration, 10)}`, result[0]]]
      : result.reduce((p, c, i, a) => {
          if (a.length - 1 === i) {
            return p.concat([
              [`${i * splitDuration}-${parseInt(duration, 10)}`, c],
            ])
          }
          return p.concat([
            [`${i * splitDuration}-${(i + 1) * splitDuration}`, c],
          ])
        }, [])
  } finally {
    // Try deleting the files one more time
    for (const path of savedPaths) {
      tryDeletingFile(path)
    }
  }
}

async function ashmanov(path, duration) {
  const formData = new FormData()
  formData.append('model_type', 'wav2letter')
  formData.append('filename', '67006370772')

  const buffer = fs.readFileSync(path)
  // const blob = Blob.createBlob(Uint8Array.from(buffer).buffer)

  formData.append('audio_blob', Uint8Array.from(buffer))

  const response = await axios({
    method: 'post',
    url: 'https://asr.ashmanov.org/asr/',
    data: formData,
    headers: {
      Authorization: 'Basic YW5uOjVDdWlIT0NTMlpRMQ==',
    },
  })

  return [[`0-${parseInt(duration, 10)}`, JSON.stringify(response)]]
}

function splitPath(path, duration) {
  const trackLength = 15
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
      timeout: 120 * 1000,
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
