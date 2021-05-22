const ffmpeg = require('fluent-ffmpeg')
const temp = require('temp')
const tryDeletingFile = require('../helpers/deleteFile')
const https = require('https')
const fs = require('fs')

const witLanguages = JSON.parse(process.env.WIT_LANGUAGES)

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
          .on('error', (error) => {
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
    const req = https.request(options, (res) => {
      const chunks = []

      res.on('data', (chunk) => {
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

    const stream = fs.createReadStream(path)
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

async function recognize(flacPath, chat, duration, ogaPath) {
  const token = witLanguages[chat.witLanguage]
  const iLanguage = chat.witLanguage
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
        result = result.concat(responses.map((r) => (r || '').trim()))
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

const i18nCodes = {
  Afrikaans: 'af',
  Albanian: 'sq',
  Arabic: 'ar',
  Azerbaijani: 'az',
  Bengali: 'bn',
  Bosnian: 'bs',
  Bulgarian: 'bg',
  Burmese: 'my',
  Catalan: 'ca',
  'Central Khmer': 'km',
  Chinese: 'zh',
  Croatian: 'hr',
  Czech: 'cs',
  Danish: 'da',
  Dutch: 'nl',
  English: 'en',
  Estonian: 'et',
  Finnish: 'fi',
  French: 'fr',
  Georgian: 'ka',
  German: 'de',
  Greek: 'el',
  Greenlandic: 'kl',
  Hausa: 'ha',
  Hebrew: 'he',
  Hindi: 'hi',
  Hungarian: 'hu',
  Icelandic: 'is',
  Igbo: 'ig',
  Indonesian: 'id',
  Inuktitut: 'iu',
  Italian: 'it',
  Japanese: 'ja',
  Kannada: 'kn',
  Kinyarwanda: 'rw',
  Korean: 'ko',
  Lao: 'lo',
  Latin: 'la',
  Lithuanian: 'lt',
  Macedonian: 'mk',
  Malay: 'ms',
  Maori: 'mi',
  Mongolian: 'mn',
  Nepali: 'ne',
  Norwegian: 'no',
  Pashto: 'ps',
  Persian: 'fa',
  Polish: 'pl',
  Portugese: 'pt',
  Romanian: 'ro',
  Russian: 'ru',
  Serbian: 'sr',
  Slovak: 'sk',
  Slovenian: 'sl',
  Somali: 'so',
  'Southern Ndebele': 'nr',
  'Southern Sotho': 'st',
  Spanish: 'es',
  Swahili: 'sw',
  Swati: 'ss',
  Swedish: 'sv',
  Tagalog: 'tl',
  Tamil: 'ta',
  Telugu: 'te',
  Thai: 'th',
  Tsonga: 'ts',
  Tswana: 'tn',
  Turkish: 'tr',
  Ukrainian: 'ua',
  Urdu: 'ur',
  Uzbek: 'uz',
  Venda: 've',
  Vietnamese: 'vi',
  Xhosa: 'xh',
  Yoruba: 'yo',
  Zulu: 'zu',
}

const defaultLanguageCode = 'English'

function languageForTelegramCode(telegramCode) {
  if (!telegramCode) {
    return defaultLanguageCode
  }
  for (const key of Object.keys(i18nCodes)) {
    if (telegramCode.toLowerCase().indexOf(key.toLowerCase())) {
      return key
    }
  }
  return defaultLanguageCode
}

module.exports = {
  code: 'wit',
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
