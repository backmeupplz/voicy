import {
  modelOptions,
  prop,
  getModelForClass,
  plugin,
} from '@typegoose/typegoose'
import { FindOrCreate } from '@typegoose/typegoose/lib/defaultClasses'
import * as findorcreate from 'mongoose-findorcreate'

@plugin(findorcreate)
@modelOptions({ schemaOptions: { timestamps: true } })
export class MessageStats extends FindOrCreate {
  @prop({ required: true, index: true })
  date: Date
  @prop({ required: true, default: 0 })
  count: number
}

export const MessageStatsModel = getModelForClass(MessageStats)
