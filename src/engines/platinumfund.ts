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

interface PlatinumFundRecognitionResult {
  status: string
  result?: {
    text: string
  }
  message?: string
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

  const { data: recognitionResult } =
    await axios.request<PlatinumFundRecognitionResult>({
      method: 'POST',
      url: 'https://vosk.platinum.fund/api/v1/stt',
      data: bodyFormData,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${bodyFormData.getBoundary()}`,
      },
    })

  if (recognitionResult.status === 'error') {
    throw new Error(recognitionResult.message)
  }

  return Promise.resolve([
    {
      text: recognitionResult.result.text,
      timeCode: `0-${duration}`,
    },
  ])
}

export const platinumfund: EngineRecognizer = {
  code: Engine.platinumfund,
  name: 'Platinum Fund',
  messageWhenEngineIsSet:
    'Platinum Fund team has kindly provided us with their speech to text server API. Keep in mind that Voicy is not affiliated with Platinum Fund in any way. Use this engine at your own risk.',
  languages: Object.keys(platinumFundLanguages).map((l) => ({
    code: l,
    name: l,
    i18nCode: platinumFundLanguages[l],
  })),
  defaultLanguageCode,
  languageForTelegramCode,
  recognize,
}
