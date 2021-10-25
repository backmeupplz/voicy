import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose'

@modelOptions({ schemaOptions: { timestamps: true } })
export class PromoException {
  @prop({ required: true, index: true })
  id: number
}

export const PromoExceptionModel = getModelForClass(PromoException)
