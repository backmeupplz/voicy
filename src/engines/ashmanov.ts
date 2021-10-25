import Engine from '@/helpers/engine/Engine'
import EngineRecognizer from '@/helpers/engine/EngineRecognizer'
import RecognitionConfig from '@/helpers/engine/RecognitionConfig'
import { statSync, createReadStream } from 'fs'
import axios, { AxiosResponse } from 'axios'
import * as FormData from 'form-data'

interface AshmanovResponse {
  r: {
    response: {
      text: string
    }[]
  }[]
}

async function recognize({ duration, ogaPath }: RecognitionConfig) {
  const formData = new FormData()
  formData.append('model_type', 'ASR')
  formData.append('filename', '67006370772')
  formData.append('audio_blob', createReadStream(ogaPath), {
    knownLength: statSync(ogaPath).size,
  })

  const headers = {
    ...formData.getHeaders(),
    'Content-Length': `${formData.getLengthSync()}`,
    Authorization: 'Basic YW5uOjVDdWlIT0NTMlpRMQ==',
  }

  const { data }: AxiosResponse<AshmanovResponse> = await axios.post(
    'https://asr.nanosemantics.ai/asr/',
    formData,
    {
      headers,
    }
  )
  const text = data.r[0].response[0].text
  return [{ timeCode: `0-${duration}`, text }]
}

export const ashmanov: EngineRecognizer = {
  code: Engine.ashmanov,
  name: 'Nanosemantics',
  messageWhenEngineIsSet:
    'Пожалуйста, заметьте, что Nanosemantics — это движок распознавания речи, который никак не аффилирован с Войси. Команда Войси не отвечат за то, насколько сохранны ваши данные при использовании движка Nanosemantics, так что используйте на свои страх и риск. Спасибо!',
  languageForTelegramCode: () => 'ru',
  defaultLanguageCode: 'ru',
  recognize,
  languageException: 'ashmanov_language',
  languages: [{ code: 'ru', name: 'Русский', i18nCode: 'ru' }],
}
