import * as findorcreate from 'mongoose-findorcreate'
import { FindOrCreate } from '@typegoose/typegoose/lib/defaultClasses'
import {
  getModelForClass,
  modelOptions,
  plugin,
  prop,
} from '@typegoose/typegoose'

@plugin(findorcreate)
@modelOptions({ schemaOptions: { timestamps: true } })
export class MessageStats extends FindOrCreate {
  @prop({ required: true, index: true })
  date: Date
  @prop({ required: true, default: 0 })
  count: number
}

export const MessageStatsModel = getModelForClass(MessageStats)
