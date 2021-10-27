import { Chat } from '@/models/Chat'
import EngineRecognizer from '@/helpers/engine/EngineRecognizer'
import engines from '@/engines'

export default function localeCodeForChat(chat: Chat) {
  const engineObject: EngineRecognizer = engines[chat.engine]
  const language =
    chat.languages[chat.engine] || engineObject.defaultLanguageCode
  const languageObject =
    engineObject.languages.find((l) => l.code === language) ||
    engineObject.languages.find(
      (l) => l.code === engineObject.defaultLanguageCode
    )
  return languageObject.i18nCode
}
