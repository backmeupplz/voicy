const { localizations } = require('./helpers/languages')
const fs = require('fs')

const map = {
  '📁 Wonderful! *Voicy* will *ignore* all audio files in this chat since now.':
    'files_false',
  '📁 Wonderful! *Voicy* will *try to recognize* all audio files in this chat since now.':
    'files_true',
  'Reply to this message with the Google Cloud credentials file (.json) to set up Google Speech voice recognition. Not sure what is this and how to get it? Check out [our quick tutorial](https://medium.com/@nikitakolmogorov/setting-up-google-speech-for-voicybot-b806545750f8).':
    'google',
  'Sorry, you should reply with a credentials document.': 'google_error_doc',
  "Sorry, document's mime type should be .": 'google_error_mime',
  'Congratulations! *Voicy* got the credentials file for the *$[1]* Google Cloud Project. Now you are able to use Google Speech recognition.':
    'google_success',
  '😎 *Voicy* converts speech to text from any voice messages and audio files (.ogg, .flac, .wav, .mp3) it receives. You can either talk to *Voicy* in the private chat or add it to a group.\n\nIf you want to use this bot in private messages, please, create a private group with anyone and add *Voicy* there. If you want to add *Voicy* to a group chat, please, add it as a participant on the group profile or to the group in the *Voicy* bot profile.\n\n/help — Shows this message 😱\n/engine — Lets you pick a voice recognition engine: wit.ai, Yandex SpeechKit or Google Speech ⚙\n/language — Lets you pick a voice recognition language 📣\n/lock — Toggles lock or unlock of non-admins using commands in group chats 🔑\n/files — Toggles if the bot should attempt to convert audio files or just ignore them 📁\n/silent — Toggles silent mode when no extra messages like `Voice recognition is initiated` are sent 😶\n/google — Set up google credentials for Google Speech 🦆\n\nLike this bot? Leave a review [here](https://telegram.me/storebot?start=voicybot) 👍\n\nAddress any concerns and questions to my creator — @borodutch\\_support 🦄':
    'help',
  '😅 Sorry, but this command only works in group chats.': 'error_group',
  '🔑 Great! *Voicy* will now respond only to command calls sent by *admins* in this chat.':
    'lock_true',
  '🔑 Great! *Voicy* will now respond only to command calls from *anyone* in this chat.':
    'lock_false',
  '😶 Magnificent! *Voicy* will now work in *silent mode*: it will not send any messages to the chat except for the actual voice transcriptions.':
    'silent_true',
  '😏 Magnificent! *Voicy* will now work in *usual mode*: it will send `Voice recognition is initiated` messages right after it receives voice messages.':
    'silent_false',
  "👋 Hello there! *Voicy* is a voice recognition bot that converts all voice messages and audio files (.ogg, .flac, .wav, .mp3) it gets into text.\n\n*Voicy* supports three voice recognition engines: wit.ai, Yandex SpeechKit and Google Speech. Initially it's set to use wit.ai but you can switch to Google Speech or Yandex SpeechKit anytime in /engine. More information in /help.":
    'start',
  '👋 Please, select the engine of speech recognition. Google Speech is more accurate, but has to be set up with your Google Cloud credentials (a bit tedious). Yandex SpeechKit is pretty accurate, free, but has limited list of languages. Wit.ai is less accurate, free, but has plenty of languages. Please, note that all three support different languages, so pick the one that suits you the best.':
    'engine',
  'Only the person who started command can select options': 'callback_error',
  "👍 Now *Voicy* uses *$[1]* in this chat. Thank you! Don't forget to set /language.":
    'engine_success',
  '👋 Please select the language of speech recognition for $[1]': 'language',
  '👋 Please select the language of speech recognition':
    'language_without_engine',
  '👍 Now *Voicy* speaks *$[1]* (Yandex SpeechKit) in this chat. Thank you!':
    'language_yandex',
  '👋 Please select the language of speech recognition for wit.ai.':
    'language_wit',
  '👍 Now *Voicy* speaks *$[1]* (wit.ai) in this chat. Thank you!':
    'language_success_wit',
  '👋 Please select the language of speech recognition for Google Speech.':
    'language_google',
  '👍 Now *Voicy* speaks *$[1]* (Google Speech) in this chat. Thank you!':
    'language_success_google',
  "_👮 I can't recognize voice messages larger than 20 megabytes_":
    'error_twenty',
  '_🦄 Voice recognition is initiated..._': 'initiated',
  "_👮 Please, speak clearly, I couldn't recognize that_": 'speak_clearly',
  "_👮 I couldn't recognize that_": 'error',
  '😮 Please, set up google credentials with the /google command or change the engine with the /engine command. Your credentials are not set up yet.':
    'google_error_creds',
  'Looks like your personal Google Cloud credentials were not set yet. Please, do so in @voicybot before trying to enable your Google key in this chat.':
    'google_enable_personal_not_setup',
  'Wonderful. Your Google Cloud credentials will now be used in this chat.':
    'google_enable_success',
  'Looks like your personal Google Cloud credentials were not set yet. Please, do so in @voicybot before trying to disable your Google key in this chat.':
    'google_disable_personal_not_setup',
  "This chat doesn't use your credentials already.":
    'google_disable_error_wrong_key',
  'Wonderful. Your Google Cloud credentials will not be used in this chat anymore.':
    'google_disable_success',
}

for (const string of Object.keys(localizations)) {
  const strings = localizations[string]
  for (const locale of Object.keys(strings)) {
    let text = strings[locale]
    if (text.indexOf('\n') > -1) {
      text.replace('\n', '\n  ')
      text = `|\n  ${text}`
    }
    fs.appendFileSync(`./locales/${locale}.yaml`, `\n${map[string]}: "${text}"`)
  }
}
