import { Schema } from 'mongoose'
import {
  Severity,
  getModelForClass,
  index,
  modelOptions,
  prop,
} from '@typegoose/typegoose'
import {
  TranscriptionJobSourceKind,
  TranscriptionResultPart,
  WorkerEngineMetadata,
} from '@/models/TranscriptionJob'

@index({ cacheKey: 1 }, { unique: true })
@index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
@modelOptions({
  schemaOptions: { timestamps: true },
  options: { allowMixed: Severity.ALLOW },
})
export class TranscriptionResultCache {
  @prop({ required: true })
  cacheKey: string
  @prop()
  fileUniqueId?: string
  @prop({ required: true, enum: TranscriptionJobSourceKind })
  sourceKind: TranscriptionJobSourceKind
  @prop()
  resultText?: string
  @prop({ type: Schema.Types.Mixed })
  resultParts?: TranscriptionResultPart[]
  @prop()
  recognitionLanguage?: string
  @prop()
  workerEngine?: string
  @prop({ type: Schema.Types.Mixed })
  workerEngineMetadata?: WorkerEngineMetadata
  @prop()
  duration?: number
  @prop()
  completedAt?: Date
  @prop({ required: true })
  expiresAt: Date
}

export const TranscriptionResultCacheModel = getModelForClass(
  TranscriptionResultCache
)
