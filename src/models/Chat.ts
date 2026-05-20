import * as findorcreate from 'mongoose-findorcreate'
import { FindOrCreate } from '@typegoose/typegoose/lib/defaultClasses'
import {
  Severity,
  getModelForClass,
  modelOptions,
  plugin,
  prop,
} from '@typegoose/typegoose'

@plugin(findorcreate)
@modelOptions({
  schemaOptions: { timestamps: true },
  options: { allowMixed: Severity.ALLOW },
})
export class Chat extends FindOrCreate {
  @prop({ required: true, unique: true, index: true })
  id: string
  @prop({ required: true, default: 'en' })
  uiLanguage: string
  @prop({ required: true, default: false })
  uiLanguageSelectedManually: boolean
  @prop({ required: true, default: false })
  adminLocked: boolean
  @prop({ required: true, default: false })
  silent: boolean
  @prop({ required: true, default: true })
  filesBanned: boolean
  @prop({ required: true, default: true })
  transcribeAllAudio: boolean
  @prop({ required: true, default: true })
  botCanSendMessages: boolean
  @prop({ required: true, default: false })
  transcriptionDisabledUntilReachable: boolean
  @prop()
  transcriptionUnreachableReason?: string
  @prop()
  transcriptionUnreachableAt?: Date
  @prop()
  transcriptionReachableAt?: Date
  @prop()
  lastVoiceMessageSentAt?: Date
  @prop({ required: true, default: false })
  paid: boolean
  @prop()
  stripeCheckoutSessionId?: string
  @prop()
  stripePaymentIntentId?: string
  @prop()
  stripePaidAt?: Date
  @prop()
  stripeAmountSubtotal?: number
  @prop()
  stripeAmountTotal?: number
  @prop()
  stripeCurrency?: string
  @prop()
  stripePriceId?: string
  @prop()
  stripeDonationTier?: string
  @prop()
  telegramPaymentChargeId?: string
  @prop()
  telegramStarsPaidAt?: Date
  @prop()
  telegramStarsAmount?: number
  @prop()
  telegramStarsDonationTier?: string
  @prop()
  telegramStarsPayerUserId?: string
  @prop({ required: true, default: false })
  banned: boolean
}

export const ChatModel = getModelForClass(Chat)
