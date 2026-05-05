import {
  Severity,
  getModelForClass,
  index,
  modelOptions,
  prop,
} from '@typegoose/typegoose'

@index({ telegramUserId: 1 }, { unique: true })
@modelOptions({
  schemaOptions: { timestamps: true },
  options: { allowMixed: Severity.ALLOW },
})
export class GoldenBorodutchFreeTranscription {
  @prop({ required: true, unique: true, index: true })
  telegramUserId: string
  @prop({ required: true, default: 0 })
  transcriptionsUsed: number
  @prop({ required: true, default: false })
  lastMembershipAllowed: boolean
  @prop()
  lastMembershipStatus?: string
  @prop()
  lastMembershipCheckedAt?: Date
  @prop()
  lastMembershipError?: string
}

export const GoldenBorodutchFreeTranscriptionModel = getModelForClass(
  GoldenBorodutchFreeTranscription
)
