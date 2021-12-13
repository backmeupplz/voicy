import { createReadStream } from 'fs'
import Engine from '@/helpers/engine/Engine'
import EngineRecognizer from '@/helpers/engine/EngineRecognizer'
import RecognitionConfig from '@/helpers/engine/RecognitionConfig'
import RecognitionResultPart from '@/helpers/engine/RecognitionResultPart'
import axios from 'axios'
import FormData = require('form-data')

const platinumFundLanguages = {
  Vietnamese: 'vn',
  French: 'fr',
  English: 'en',
  Chinese: 'cn',
  Catalan: 'ca',
  Italian: 'it',
  Kazakh: 'kz',
  Turkish: 'tr',
  Spanish: 'es',
  Portuguese: 'pt',
  German: 'de',
  Ukrainian: 'uk',
  Swedish: 'sv',
  Farsi: 'fa',
  Russian: 'ru',
}

const defaultLanguageCode = 'English'

function languageForTelegramCode(telegramCode: string): string {
  if (!telegramCode) {
    return defaultLanguageCode
  }
  for (const key of Object.keys(platinumFundLanguages)) {
    if (telegramCode.toLowerCase().includes(key.toLowerCase())) {
      return key
    }
  }
  return defaultLanguageCode
}

async function recognize({
  chat,
  duration,
  ogaPath,
}: RecognitionConfig): Promise<RecognitionResultPart[]> {
  const bodyFormData = new FormData()
  bodyFormData.append(
    'lang',
    platinumFundLanguages[chat.languages[Engine.platinumfund]]
  )
  bodyFormData.append('speech', createReadStream(ogaPath))

  try {
    const { data: recognitionResult } = await axios({
      method: 'POST',
      url: 'https://vosk.platinum.fund/api/v1/stt',
      data: bodyFormData,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${bodyFormData.getBoundary()}`,
      },
    })

    if (recognitionResult['status'] === 'error') {
      console.info(
        `platinum.fund recognition error: ${recognitionResult['message']}`
      )
      throw new Error('Platinum fund recognition error')
    }

    return Promise.resolve([
      {
        text: recognitionResult['result']['text'],
        timeCode: `${0 - duration}`,
      },
    ])
  } catch (e) {
    throw new Error('Platinum fund. Axios error')
  }
}

export const platinumfund: EngineRecognizer = {
  code: Engine.platinumfund,
  name: 'platinumfund',
  languages: Object.keys(platinumFundLanguages).map((l) => ({
    code: l,
    name: l,
    i18nCode: platinumFundLanguages[l],
  })),
  defaultLanguageCode,
  languageForTelegramCode,
  recognize,
}
