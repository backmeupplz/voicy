import Engine from '@/helpers/engine/Engine'
import {
  modelOptions,
  prop,
  getModelForClass,
  plugin,
  Severity,
} from '@typegoose/typegoose'
import { FindOrCreate } from '@typegoose/typegoose/lib/defaultClasses'
import { Schema } from 'mongoose'
import * as findorcreate from 'mongoose-findorcreate'

type Languages = Map<Engine, string>

@plugin(findorcreate)
@modelOptions({
  schemaOptions: { timestamps: true },
  options: { allowMixed: Severity.ALLOW },
})
export class Chat extends FindOrCreate {
  @prop({ required: true, unique: true, index: true })
  id: string
  @prop({ required: true, index: true, enum: Engine, default: Engine.wit })
  engine: Engine
  @prop({ required: true, default: false })
  adminLocked: boolean
  @prop({ required: true, default: false })
  silent: boolean
  @prop({ required: true, default: true })
  filesBanned: boolean
  @prop()
  googleSetupMessageId?: number
  @prop()
  googleKey?: string
  @prop()
  witToken?: string
  @prop({ required: true, default: false })
  timecodesEnabled: boolean
  @prop()
  lastVoiceMessageSentAt?: Date
  @prop({ required: true, type: Schema.Types.Mixed, default: {} })
  languages: Languages
}

export const ChatModel = getModelForClass(Chat)
