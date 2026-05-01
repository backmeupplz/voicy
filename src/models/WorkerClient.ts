import * as crypto from 'crypto'
import { Schema } from 'mongoose'
import {
  Severity,
  getModelForClass,
  index,
  modelOptions,
  prop,
} from '@typegoose/typegoose'

export interface WorkerClientCapabilities {
  engine?: string
  platform?: string
  languages?: string[]
  gpu?: string
}

@index({ tokenHash: 1 }, { unique: true })
@modelOptions({
  schemaOptions: { timestamps: true },
  options: { allowMixed: Severity.ALLOW },
})
export class WorkerClient {
  @prop({ required: true, unique: true, index: true })
  name: string
  @prop({ required: true, unique: true, index: true })
  tokenHash: string
  @prop({ required: true, default: true, index: true })
  enabled: boolean
  @prop()
  lastSeenAt?: Date
  @prop()
  lastClaimedAt?: Date
  @prop({ type: Schema.Types.Mixed })
  capabilities?: WorkerClientCapabilities
}

export const WorkerClientModel = getModelForClass(WorkerClient)

export function hashWorkerToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function generateWorkerToken() {
  return `voicy_worker_${crypto.randomBytes(32).toString('base64url')}`
}
