import { Chat } from '@/models/Chat'

interface RecognitionConfig {
  flacPath: string
  chat: Partial<Chat>
  duration: number
  ogaPath: string
}

export default RecognitionConfig
