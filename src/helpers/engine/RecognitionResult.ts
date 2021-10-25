import RecognitionResultPart from '@/helpers/engine/RecognitionResultPart'

export default interface RecognitionResult {
  textWithTimecodes: RecognitionResultPart[]
  duration: number
}
