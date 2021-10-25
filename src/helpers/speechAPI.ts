import { Chat } from '@/models/Chat'
import engines from '@/engines'

export default function getText(
  flacPath: string,
  chat: Chat,
  duration: number,
  ogaPath: string
) {
  const engineObject = engines[chat.engine]
  return engineObject.recognize({ flacPath, chat, duration, ogaPath })
}
