import * as temp from 'temp'
import { createReadStream } from 'fs'
import { request } from 'https'
import Engine from '@/helpers/engine/Engine'
import EngineRecognizer from '@/helpers/engine/EngineRecognizer'
import RecognitionConfig from '@/helpers/engine/RecognitionConfig'
import deleteFile from '@/helpers/deleteFile'
import ffmpeg = require('fluent-ffmpeg')
import RecognitionResultPart from '@/helpers/engine/RecognitionResultPart'

const i18nCodes = {
  Arabic: 'ar',
  Bengali: 'bn',
  Burmese: 'my',
  Catalan: 'ca',
  Chinese: 'zh',
  Dutch: 'nl',
  English: 'en',
  Finnish: 'fi',
  French: 'fr',
  German: 'de',
  Hindi: 'hi',
  Indonesian: 'id',
  Italian: 'it',
  Japanese: 'ja',
  Kannada: 'kn',
  Korean: 'ko',
  Malay: 'ms',
  Malayalam: 'ml',
  Marathi: 'mr',
  Polish: 'pl',
  Portuguese: 'pt',
  Russian: 'ru',
  Sinhalese: 'si',
  Spanish: 'es',
  Swedish: 'sv',
  Tagalog: 'tl',
  Tamil: 'ta',
  Telugu: 'te',
  Thai: 'th',
  Turkish: 'tr',
  Urdu: 'ur',
  Vietnamese: 'vi',
}

const witLanguages = JSON.parse(process.env.WIT_LANGUAGES)
for (const key of Object.keys(witLanguages)) {
  if (!i18nCodes[key]) {
    delete witLanguages[key]
  }
}

function splitPath(path, duration) {
  const trackLength = 15
  const lastTrackLength = duration % trackLength

  const promises = []
  for (let i = 0; i < duration; i += trackLength) {
    const splitDuration =
      i + trackLength <= duration ? trackLength : lastTrackLength
    if (splitDuration > 1) {
      const output = temp.path({ suffix: '.flac' })
      promises.push(
        new Promise((res, rej) => {
          ffmpeg()
            .input(path)
            .on('error', (error) => {
              rej(error)
            })
            .on('end', () => res(output))
            .output(output)
            .setStartTime(i)
            .duration(splitDuration)
            .audioFrequency(16000)
            .toFormat('s16le')
            .run()
        })
      )
    }
  }
  return Promise.all(promises)
}

function recognizePath(path, token) {
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
    const req = request(options, (res) => {
      const chunks = []

      res.on('data', (chunk) => {
        chunks.push(chunk)
      })

      res.on('end', () => {
        try {
          const body = Buffer.concat(chunks)
          try {
            const json = JSON.parse(body.toString())
            if (json.error) {
              const error = new Error(json.error)
              error.message = `(${json.code}): ${error.message}`
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
              console.log('JSON error:', body)
              reject(err)
            } catch (error) {
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

      res.on('error', (err) => {
        try {
          reject(err)
        } catch (error) {
          // Do nothing
        }
      })
    })

    req.on('error', (err) => {
      try {
        reject(err)
      } catch (error) {
        // Do nothing
      }
    })

    const stream = createReadStream(path)
    stream.pipe(req)
    let error
    stream.on('error', (err) => {
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

async function recognize({
  chat,
  duration,
  ogaPath,
}: RecognitionConfig): Promise<RecognitionResultPart[]> {
  const token =
    chat.witToken ||
    witLanguages[chat.languages[Engine.wit] || defaultLanguageCode]
  const iLanguage = chat.languages[Engine.wit]
  const paths = await splitPath(ogaPath, duration)
  const savedPaths = paths.slice()
  try {
    let result = []
    while (paths.length) {
      const pathsToRecognize = paths.splice(0, 5)
      const pathsToDelete = pathsToRecognize.slice()
      const promises = []
      for (const path of pathsToRecognize) {
        promises.push(
          // eslint-disable-next-line no-async-promise-executor
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
                  `Retrying ${iLanguage} ${path}, attempts left — ${triesCount}, error: ${err.message}`
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
        if (!responses.length) {
          responses.push('')
        }
        result = result.concat(responses.map((r) => (r || '').trim()))
      } finally {
        for (const path of pathsToDelete) {
          deleteFile(path)
        }
      }
    }
    const splitDuration = 15
    return result.length < 2
      ? [{ timeCode: `0-${duration}`, text: result[0] }]
      : result.reduce((p, c, i, a) => {
          if (a.length - 1 === i) {
            return p.concat([
              { timeCode: `${i * splitDuration}-${duration}`, text: c },
            ])
          }
          return p.concat([
            {
              timeCode: `${i * splitDuration}-${(i + 1) * splitDuration}`,
              text: c,
            },
          ])
        }, [])
  } finally {
    // Try deleting the files one more time
    for (const path of savedPaths) {
      deleteFile(path)
    }
  }
}

const defaultLanguageCode = 'English'

function languageForTelegramCode(telegramCode) {
  if (!telegramCode) {
    return defaultLanguageCode
  }
  for (const key of Object.keys(i18nCodes)) {
    if (telegramCode.toLowerCase().includes(key.toLowerCase())) {
      return key
    }
  }
  return defaultLanguageCode
}

export const wit: EngineRecognizer = {
  code: Engine.wit,
  name: 'Wit.ai',
  languages: Object.keys(witLanguages).map((l) => ({
    code: l,
    name: l,
    i18nCode: i18nCodes[l],
  })),
  recognize,
  languageForTelegramCode,
  defaultLanguageCode,
}
