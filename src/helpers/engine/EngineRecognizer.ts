import Engine from '@/helpers/engine/Engine'
import RecognitionConfig from '@/helpers/engine/RecognitionConfig'
import RecognitionResultPart from '@/helpers/engine/RecognitionResultPart'
import Language from '@/helpers/engine/Language'

export default interface EngineRecognizer {
  code: Engine
  name: string
  messageWhenEngineIsSet?: string
  languages: Language[]
  recognize: (config: RecognitionConfig) => Promise<RecognitionResultPart[]>
  languageForTelegramCode: (telegramCode: string) => string
  defaultLanguageCode: string
  languageException?: string
}
