import * as findorcreate from 'mongoose-findorcreate'
import { FindOrCreate } from '@typegoose/typegoose/lib/defaultClasses'
import { Schema } from 'mongoose'
import {
  Severity,
  getModelForClass,
  modelOptions,
  plugin,
  prop,
} from '@typegoose/typegoose'
import Engine from '@/helpers/engine/Engine'

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
  @prop({
    required: true,
    type: Schema.Types.Mixed,
    default: {
      ashmanov: 'ru',
      google: 'en-US',
      wit: 'English',
      platinumfund: 'English',
    },
  })
  languages: Languages
  @prop({ required: true, default: false })
  paid: boolean
}

export const ChatModel = getModelForClass(Chat)
