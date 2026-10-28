import {
  Severity,
  getModelForClass,
  index,
  modelOptions,
  prop,
} from '@typegoose/typegoose'

// A broadcast's progress (src/helpers/broadcast.ts). state: drawn (both lists
// saved), sending, done, stopped. A stop is final: the same id never sends again.
@modelOptions({
  schemaOptions: { timestamps: true },
  options: { allowMixed: Severity.ALLOW },
})
export class Broadcast {
  @prop({ required: true, unique: true, index: true })
  id: string
  @prop()
  state?: string
  @prop()
  reason?: string
  @prop()
  dryRunAt?: Date
  @prop()
  drawnAt?: Date
  @prop()
  startedAt?: Date
  @prop()
  doneAt?: Date
  @prop()
  previewSentAt?: Date
  @prop()
  lastStatusAt?: Date
}

// One chat drawn for a broadcast: arm a (gets the message) or holdout (never
// does). The unique (broadcast, chatId) pair is what keeps a send to one per chat.
// state: drawn, sending (claimed), sent, unreachable, failed
@index({ broadcast: 1, chatId: 1 }, { unique: true })
@index({ broadcast: 1, arm: 1, state: 1, rank: 1 })
@index({ chatId: 1 })
@modelOptions({
  schemaOptions: { timestamps: true },
  options: { allowMixed: Severity.ALLOW },
})
export class BroadcastRecipient {
  @prop({ required: true })
  broadcast: string
  @prop({ required: true })
  chatId: string
  @prop({ required: true })
  arm: string
  @prop({ required: true })
  lang: string
  @prop({ required: true })
  rank: string
  @prop({ required: true, default: 'drawn' })
  state: string
  @prop()
  sentAt?: Date
  @prop()
  error?: string
  @prop()
  blockedAt?: Date
  @prop()
  optOutAt?: Date
}

export const BroadcastModel = getModelForClass(Broadcast)
export const BroadcastRecipientModel = getModelForClass(BroadcastRecipient)
