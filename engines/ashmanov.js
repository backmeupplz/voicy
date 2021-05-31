const axios = require('axios')
const FormData = require('form-data')
const fs = require('fs')

const defaultLanguageCode = 'ru'

function languageForTelegramCode() {
  return defaultLanguageCode
}

async function recognize(flacPath, chat, duration, path) {
  const formData = new FormData()
  formData.append('model_type', 'ASR')
  formData.append('filename', '67006370772')
  formData.append('audio_blob', fs.createReadStream(path), {
    knownLength: fs.statSync(path).size,
  })

  const headers = {
    ...formData.getHeaders(),
    'Content-Length': formData.getLengthSync(),
    Authorization: 'Basic YW5uOjVDdWlIT0NTMlpRMQ==',
  }

  const response = (
    await axios({
      method: 'post',
      url: 'https://asr.nanosemantics.ai/asr/',
      data: formData,
      headers,
    })
  ).data.r[0].response[0].text
  return [[`0-${parseInt(duration, 10)}`, response]]
}

module.exports = {
  code: 'ashmanov',
  name: 'Nanosemantics',
  messageWhenEngineIsSet:
    'Пожалуйста, заметьте, что Nanosemantics — это движок распознавания речи, который никак не аффилирован с Войси. Команда Войси не отвечат за то, насколько сохранны ваши данные при использовании движка Nanosemantics, так что используйте на свои страх и риск. Спасибо!',
  languageForTelegramCode,
  defaultLanguageCode,
  recognize,
  languageException: 'ashmanov_language',
  languages: [{ code: 'ru', name: 'Русский', i18nCode: 'ru' }],
}
