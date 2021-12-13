import { Chat } from '@/models/Chat'
import Engine from '@/helpers/engine/Engine'

export default function isRuChat(chat: Chat) {
  return (
    chat.engine === Engine.ashmanov ||
    (chat.engine === Engine.wit && chat.languages[Engine.wit] === 'Russian') ||
    (chat.engine === Engine.google &&
      chat.languages[Engine.google] === 'ru-RU') ||
    (chat.engine === Engine.platinumfund &&
      chat.languages[Engine.platinumfund] === 'Russian')
  )
}
