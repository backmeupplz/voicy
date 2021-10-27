import { Chat } from '@/models/Chat'
import {
  Severity,
  getModelForClass,
  modelOptions,
  prop,
} from '@typegoose/typegoose'
import Engine from '@/helpers/engine/Engine'
import RecognitionResultPart from '@/helpers/engine/RecognitionResultPart'
import engines from '@/engines'

@modelOptions({
  schemaOptions: { timestamps: true },
  options: { allowMixed: Severity.ALLOW },
})
export class Voice {
  @prop({ required: true })
  url: string
  @prop({ required: true, enum: Engine, default: Engine.wit })
  engine: Engine
  @prop({ required: true })
  duration: number
  @prop({ required: true })
  language: string
  @prop()
  text?: string
  @prop()
  textWithTimecodes?: string[][]
  @prop()
  file?: string
}

export const VoiceModel = getModelForClass(Voice)

export function addVoice({
  url,
  chat,
  duration,
  textWithTimecodes,
  fileId,
}: {
  url: string
  chat: Chat
  duration: number
  textWithTimecodes: RecognitionResultPart[]
  fileId: string
}) {
  const language =
    chat.languages[chat.engine] || engines[chat.engine].defaultLanguageCode
  return VoiceModel.create({
    url,
    text: textWithTimecodes.reduce((p, c) => `${p} ${c.text}`, ''),
    language,
    duration,
    engine: chat.engine,
    textWithTimecodes: textWithTimecodes.map((v) => [v.timeCode, v.text]),
    fileId,
  })
}
