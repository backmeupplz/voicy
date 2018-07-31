const localizations = {
  '📁 Wonderful! *Voicy* will *ignore* all audio files in this chat since now.': {
    en: '📁 Wonderful! *Voicy* will *ignore* all audio files in this chat since now.',
    ru: '📁 Великолепно! *Войси* теперь будет *игнорировать* все аудио файлы в этом чате.',
  },
  '📁 Wonderful! *Voicy* will *try to recognize* all audio files in this chat since now.': {
    en: '📁 Wonderful! *Voicy* will *try to recognize* all audio files in this chat since now.',
    ru: '📁 Великолепно! *Войси* теперь будет *пробовать перевести в текст* все аудио файлы в этом чате.',
  },
  'Reply to this message with the Google Cloud credentials file (.json) to set up Google Speech voice recognition. Not sure what is this and how to get it? Check out [our quick tutorial](https://google.com).': {
    en: 'Reply to this message with the Google Cloud credentials file (.json) to set up Google Speech voice recognition. Not sure what is this and how to get it? Check out [our quick tutorial](https://medium.com/@nikitakolmogorov/setting-up-google-speech-for-voicybot-b806545750f8).',
    ru: 'Ответьте на это сообщение с файлом аутентификации для Google Cloud (.json), чтобы настроить распознавание речи от Google Speech. Не уверены, как сделать, чтобы все заработало? Прочитайте [наше короткое руководство](https://medium.com/@nikitakolmogorov/%D1%83%D1%81%D1%82%D0%B0%D0%BD%D0%BE%D0%B2%D0%BA%D0%B0-google-speech-%D0%B2-voicybot-9f8268cd58c6).',
  },
  'Sorry, you should reply with a credentials document.': {
    en: 'Sorry, you should reply with a credentials document.',
    ru: 'Ответьте, пожалуйста, аутентификационным документом.',
  },
  'Sorry, document\'s mime type should be \'text/plain\'.': {
    en: 'Sorry, document\'s mime type should be \'text/plain\'.',
    ru: 'Пожалуйста, убедитесь, что тип документа — \'text/plain\'.',
  },
  'Congratulations! *Voicy* got the credentials file for the *$[1]* Google Cloud Project. Now you are able to use Google Speech recognition.': {
    en: 'Congratulations! *Voicy* got the credentials file for the *$[1]* Google Cloud Project. Now you are able to use Google Speech recognition.',
    ru: 'Поздравляем! *Войси* получил аутентификационный документ для *$[1]* проекта Google Cloud. Теперь вы можете использовать движок Google Speech в этом чате.',
  },
  '😎 *Voicy* converts speech to text from any voice messages and audio files (.ogg, .flac, .wav, .mp3) it receives. You can either talk to *Voicy* in the private chat or add it to a group.\n\nIf you want to use this bot in private messages, please, create a private group with anyone and add *Voicy* there. If you want to add *Voicy* to a group chat, please, add it as a participant on the group profile or to the group in the *Voicy* bot profile.\n\n/help — Shows this message 😱\n/engine — Lets you pick a voice recognition engine: wit.ai, Yandex SpeechKit or Google Speech ⚙\n/language — Lets you pick a voice recognition language 📣\n/lock — Toggles lock or unlock of non-admins using commands in group chats 🔑\n/files — Toggles if the bot should attempt to convert audio files or just ignore them 📁\n/silent — Toggles silent mode when no extra messages like `Voice recognition is initiated` are sent 😶\n/google — Set up google credentials for Google Speech 🦆\n\nLike this bot? Leave a review [here](https://telegram.me/storebot?start=voicybot) 👍\n\nAddress any concerns and questions to my creator — @borodutch 🦄': {
    en: '😎 *Voicy* converts speech to text from any voice messages and audio files (.ogg, .flac, .wav, .mp3) it receives. You can either talk to *Voicy* in the private chat or add it to a group.\n\nIf you want to use this bot in private messages, please, create a private group with anyone and add *Voicy* there. If you want to add *Voicy* to a group chat, please, add it as a participant on the group profile or to the group in the *Voicy* bot profile.\n\n/help — Shows this message 😱\n/engine — Lets you pick a voice recognition engine: wit.ai, Yandex SpeechKit or Google Speech ⚙\n/language — Lets you pick a voice recognition language 📣\n/lock — Toggles lock or unlock of non-admins using commands in group chats 🔑\n/files — Toggles if the bot should attempt to convert audio files or just ignore them 📁\n/silent — Toggles silent mode when no extra messages like `Voice recognition is initiated` are sent 😶\n/google — Set up google credentials for Google Speech 🦆\n\nLike this bot? Leave a review [here](https://telegram.me/storebot?start=voicybot) 👍\n\nAddress any concerns and questions to my creator — @borodutch 🦄',
    ru: '😎 *Войси* перевеодит в текст все голосовые сообщения и аудио файлы (.ogg, .flac, .wav, .mp3), которые получает. Вы можете использовать *Войси* в личных сообщениях или добавить его в группу.\n\nЕсли вы хотите использовать *Войси* в приватных сообщениях с другими людьми, то, пожалуйста, создайте приватную группу с собеседником и добавьте туда *Войси*. Если хотите добавить *Войси* в групповой чат, то, пожалуйста, добавьте его, как собеседника в профиле группы, или в профиле *Войси*.\n\n/help — Это сообщение 😱\n/engine — Выбор движка распознавания речи: wit.ai, Yandex SpeechKit или Google Speech ⚙\n/language — Выбор языка распознавания речи 📣\n/lock — Включает и выключает обработку команд, отправленных не админами в групповых чатах 🔑\n/files — Включает и выключает обработку аудио файлов 📁\n/silent — Включает и выключает тихий режим, когда *Войси* не посылает лишних сообщений типа `Распознавание речи инициированно` 😶\n/google — Установка аутентификационного файла для использования движка Google Speech 🦆\n\nНравится бот? Оставьте отзыв [вот тут](https://telegram.me/storebot?start=voicybot) 👍\n\nВсе вопросы и пожелания по боту отправляйте напрямую создателю — @borodutch 🦄',
  },
  '😅 Sorry, but this command only works in group chats.': {
    en: '😅 Sorry, but this command only works in group chats.',
    ru: '😅 Простите, эта команда работает только в групповых чатах.',
  },
  '🔑 Great! *Voicy* will now respond only to command calls sent by *admins* in this chat.': {
    en: '🔑 Great! *Voicy* will now respond only to command calls sent by *admins* in this chat.',
    ru: '🔑 Отлично! *Войси* теперь будет реагировать только на команды, посланные *админами* в этом чате.',
  },
  '🔑 Great! *Voicy* will now respond only to command calls from *anyone* in this chat.': {
    en: '🔑 Great! *Voicy* will now respond only to command calls from *anyone* in this chat.',
    ru: '🔑 Отлично! *Войси* теперь будет реагировать на команды, посланные *кем угодно* в этом чате.',
  },
  '😶 Magnificent! *Voicy* will now work in *silent mode*: it will not send any messages to the chat except for the actual voice transcriptions.': {
    en: '😶 Magnificent! *Voicy* will now work in *silent mode*: it will not send any messages to the chat except for the actual voice transcriptions.',
    ru: '😶 Магически! *Войси* теперь работает в *тихом режиме*: он не будет посылать в чат ничего, кроме распознанного текста.',
  },
  '😏 Magnificent! *Voicy* will now work in *usual mode*: it will send `Voice recognition is initiated` messages right after it receives voice messages.': {
    en: '😏 Magnificent! *Voicy* will now work in *usual mode*: it will send `Voice recognition is initiated` messages right after it receives voice messages.',
    ru: '😏 Магически! *Войси* теперь работает в *обычном режиме*: он будет посылать сообщения типа `Распознавание голоса инициированно` сразу после получения голосовых сообщений.',
  },
  '👋 Hello there! *Voicy* is a voice recognition bot that converts all voice messages and audio files (.ogg, .flac, .wav, .mp3) it gets into text.\n\n*Voicy* supports three voice recognition engines: wit.ai, Yandex SpeechKit and Google Speech. Initially it\'s set to use wit.ai but you can switch to Google Speech or Yandex SpeechKit anytime in /engine. More information in /help.': {
    en: '👋 Hello there! *Voicy* is a voice recognition bot that converts all voice messages and audio files (.ogg, .flac, .wav, .mp3) it gets into text.\n\n*Voicy* supports three voice recognition engines: wit.ai, Yandex SpeechKit and Google Speech. Initially it\'s set to use wit.ai but you can switch to Google Speech or Yandex SpeechKit anytime in /engine. More information in /help.',
    ru: '👋 Здравствуйте! *Войси* — это бот, который переводит все голосовые сообщения и аудио файлы (.ogg, .flac, .wav, .mp3), которые получает, в текст.\n\n*Войси* поддерживает три движка распознавания речи: wit.ai, Yandex SpeechKit и Google Speech. Изначально, он использует wit.ai, но вы можете переключиться на Google Speech или Yandex SpeechKit в любое время, используя команду /engine. Больше информации в /help.',
  },
  '👋 Please, select the engine of speech recognition. Google Speech is more accurate and supports audio longer than 50 seconds, but has to be set up with your Google Cloud credentials (a bit tedious). Yandex SpeechKit is pretty accurate, free, private and most of the time supports audio longer than 50 seconds, but has limited list of languages. Wit.ai is less accurate, free, and doesn\'t support audio longer than 50 seconds, but has plenty of languages. Please, note that all three support different languages, so pick the one that suits you the best.': {
    en: '👋 Please, select the engine of speech recognition. Google Speech is more accurate and supports audio longer than 50 seconds, but has to be set up with your Google Cloud credentials (a bit tedious). Yandex SpeechKit is pretty accurate, free, private and most of the time supports audio longer than 50 seconds, but has limited list of languages. Wit.ai is less accurate, free, and doesn\'t support audio longer than 50 seconds, but has plenty of languages. Please, note that all three support different languages, so pick the one that suits you the best.',
    ru: '👋 Пожалуйста, выберите движок распознавания речи. Google Speech более точный, поддерживает аудио длиннее 50 секунд, но требует, чтобы вы установили аутентификационный файл Google Cloud (немного сложно). Yandex SpeechKit достаточно точный, бесплатный, поддерживает аудио более 50 секунд, но меньше языков. Wit.ai наименее точный, бесплатный, поддерживает файлы короче 50 секунд, но работает с большим количеством языков. Стоит отметить, что разные движки поддерживают разные языки, так что выберите тот, который подходит вам наиболее всего.',
  },
  'Only the person who started command can select options': {
    en: 'Only the person who started command can select options',
    ru: 'Только тот, кто запустил выбор, может выбирать настройки',
  },
  '👍 Now *Voicy* uses *$[1]* in this chat. Thank you! Don\'t forget to set /language.': {
    en: '👍 Now *Voicy* uses *$[1]* in this chat. Thank you! Don\'t forget to set /language.',
    ru: '👍 Теперь *Войси* использует *$[1]* в этом чате. Спасибо! Не забудьте установить язык через /language.',
  },
  '👋 Please select the language of speech recognition for $[1]': {
    en: '👋 Please select the language of speech recognition for $[1]',
    ru: '👋 Пожалуйста, выберите язык распознавания речи для $[1]',
  },
  '👋 Please select the language of speech recognition': {
    en: '👋 Please select the language of speech recognition',
    ru: '👋 Пожалуйста, выберите язык распознавания речи',
  },
  '👍 Now *Voicy* speaks *$[1]* (Yandex SpeechKit) in this chat. Thank you!': {
    en: '👍 Now *Voicy* speaks *$[1]* (Yandex SpeechKit) in this chat. Thank you!',
    ru: '👍 Теперь *Войси* использует *$[1]* (Yandex SpeechKit) в этом чате. Спасибо!',
  },
  '👋 Please select the language of speech recognition for wit.ai.': {
    en: '👋 Please select the language of speech recognition for wit.ai.',
    ru: '👋 Пожалуйста, выберите язык распознавания речи для wit.ai.',
  },
  '👍 Now *Voicy* speaks *$[1]* (wit.ai) in this chat. Thank you!': {
    en: '👍 Now *Voicy* speaks *$[1]* (wit.ai) in this chat. Thank you!',
    ru: '👍 Теперь *Войси* использует (wit.ai) В этом чате. Спасибо!',
  },
  '👋 Please select the language of speech recognition for Google Speech.': {
    en: '👋 Please select the language of speech recognition for Google Speech.',
    ru: '👋 Пожалуйста, выберите язык распознавания речи для Google Speech.',
  },
  '👍 Now *Voicy* speaks *$[1]* (Google Speech) in this chat. Thank you!': {
    en: '👍 Now *Voicy* speaks *$[1]* (Google Speech) in this chat. Thank you!',
    ru: '👍 Теперь *Войси* использует *$[1]* (Google Speech) в этом чате. Спасибо!',
  },
  '_👮 I can\'t recognize voice messages larger than 20 megabytes_': {
    en: '_👮 I can\'t recognize voice messages larger than 20 megabytes_',
    ru: '_👮 Я не умею распознавать файлы тяжелее 20 мегабайт_',
  },
  '_🦄 Voice recognition is initiated..._': {
    en: '_🦄 Voice recognition is initiated..._',
    ru: '_🦄 Распознавание речи инициированно..._',
  },
  '_👮 Wit.ai cannot recognize voice messages longer than 50 seconds_': {
    en: '_👮 Wit.ai cannot recognize voice messages longer than 50 seconds_',
    ru: '_👮 Wit.ai не умеет распознавать сообщения длиннее 50 секунд_',
  },
  '_👮 Please, speak clearly, I couldn\'t recognize that_': {
    en: '_👮 Please, speak clearly, I couldn\'t recognize that_',
    ru: '_👮 Пожалуйста, говорите четче_',
  },
  '_👮 I couldn\'t recognize that_': {
    en: '_👮 I couldn\'t recognize that_',
    ru: '_👮 У меня не получилось это распознать_',
  },
  '😮 Please, set up google credentials with the /google command or change the engine with the /engine command. Your credentials are not set up yet.': {
    en: '😮 Please, set up google credentials with the /google command or change the engine with the /engine command. Your credentials are not set up yet.',
    ru: '😮 Пожалуйста, установите аутентификационный файл для Google Cloud через команду /google или смените движок распознавания речи через /engine. Аутентификационный файл еще не установлен.',
  },
}

const languages = {
  wit: {
    English: 'en',
    Russian: 'ru',
  },
  google: {
    'ru-RU': 'ru',
    'en-AU': 'en',
    'en-CA': 'en',
    'en-GH': 'en',
    'en-GB': 'en',
    'en-IN': 'en',
    'en-IE': 'en',
    'en-KE': 'en',
    'en-NZ': 'en',
    'en-NG': 'en',
    'en-PH': 'en',
    'en-ZA': 'en',
    'en-TZ': 'en',
    'en-US': 'en',
  },
  yandex: {
    'ru-RU': 'ru',
    'en-US': 'en',
  },
}

// Exports
module.exports = {
  localizations,
  languages,
}
