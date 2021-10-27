import { getModelForClass, modelOptions, prop } from '@typegoose/typegoose'

@modelOptions({ schemaOptions: { timestamps: true } })
export class PromoException {
  @prop({ required: true, index: true, unique: true })
  id: number
}

export const PromoExceptionModel = getModelForClass(PromoException)

export const promoExceptions = [] as number[]
async function populatePromoExceptions() {
  const dbPromoExceptions = await PromoExceptionModel.find({})
  dbPromoExceptions.forEach((promoException) => {
    promoExceptions.push(promoException.id)
  })
}
void populatePromoExceptions()

export async function addPromoException(id: number) {
  if (promoExceptions.includes(id)) {
    return
  }
  await PromoExceptionModel.create({ id })
  promoExceptions.push(id)
}
