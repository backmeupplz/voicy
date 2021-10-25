import RecognitionResultPart from '@/helpers/engine/RecognitionResultPart'
import Engine from '@/helpers/engine/Engine'
import { modelOptions, prop, getModelForClass } from '@typegoose/typegoose'
import { Chat } from '@/models/Chat'

@modelOptions({ schemaOptions: { timestamps: true } })
export class Voice {
  @prop({ required: true })
  url: string
  @prop({ required: true, enum: Engine, default: Engine.wit })
  engine: Engine
  @prop({ required: true })
  duration: number
  @prop({ required: true })
  lanpuage: string
  @prop()
  text?: string
  @prop()
  textWithTimecodes?: string[][]
  @prop()
  file?: string
}

export const VoiceModel = getModelForClass(Voice)

export async function addVoice(
  url: string,
  text: string,
  chat: Chat,
  duration: number,
  textWithTimecodes: RecognitionResultPart[],
  fileId: string
) {
  const language = chat.languages[chat.engine]
  return VoiceModel.create({
    url,
    text,
    language,
    duration,
    engine: chat.engine,
    textWithTimecodes: textWithTimecodes.map((v) => [v.timeCode, v.text]),
    fileId,
  })
}
