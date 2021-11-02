import * as FormData from 'form-data'
import { createReadStream, statSync } from 'fs'
import Engine from '@/helpers/engine/Engine'
import EngineRecognizer from '@/helpers/engine/EngineRecognizer'
import RecognitionConfig from '@/helpers/engine/RecognitionConfig'
import axios, { AxiosResponse } from 'axios'

interface AshmanovResponse {
  response_code: number
  msg?: string
  r: {
    response: {
      text: string
    }[]
  }[]
}

async function recognize({ duration, flacPath }: RecognitionConfig) {
  const formData = new FormData()
  formData.append('model_type', 'ASR')
  formData.append('filename', '67006370772')
  formData.append('audio_blob', createReadStream(flacPath), {
    knownLength: statSync(flacPath).size,
  })

  const headers = {
    ...formData.getHeaders(),
    'Content-Length': `${formData.getLengthSync()}`,
    Authorization: 'Basic YW5uOjVDdWlIT0NTMlpRMQ==',
  }

  const { data } = (await axios({
    method: 'POST',
    url: 'https://asr.nanosemantics.ai/asr/',
    data: formData,
    headers,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  })) as AxiosResponse<AshmanovResponse>
  if (data.response_code === 3 && data.msg) {
    throw new Error(data.msg)
  }
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
