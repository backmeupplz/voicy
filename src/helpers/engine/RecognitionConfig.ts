import { Chat } from '@/models/Chat'

interface RecognitionConfig {
  flacPath: string
  chat: Chat
  duration: number
  ogaPath: string
}

export default RecognitionConfig
