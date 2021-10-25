import Engine from '@/helpers/engine/Engine'
import Language from '@/helpers/engine/Language'
import RecognitionConfig from '@/helpers/engine/RecognitionConfig'
import RecognitionResultPart from '@/helpers/engine/RecognitionResultPart'

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
