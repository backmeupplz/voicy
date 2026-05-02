import { Schema } from 'mongoose'
import {
  Severity,
  getModelForClass,
  index,
  modelOptions,
  prop,
} from '@typegoose/typegoose'

export enum TranscriptionJobStatus {
  queuedForDownload = 'queued_for_download',
  downloading = 'downloading',
  ready = 'ready',
  transcribing = 'transcribing',
  queued = 'queued',
  processing = 'processing',
  completed = 'completed',
  failed = 'failed',
}

export enum TranscriptionJobSourceKind {
  voice = 'voice',
  videoNote = 'video_note',
  audio = 'audio',
  document = 'document',
  video = 'video',
}

export interface TranscriptionResultPart {
  timeCode?: string
  text: string
}

export interface WorkerEngineMetadata {
  engine?: string
  model?: string
  language?: string
  duration?: number
}

@index({ status: 1, createdAt: 1 })
@index({ workerId: 1, status: 1 })
@index({ chatId: 1, sourceMessageId: 1 })
@modelOptions({
  schemaOptions: { timestamps: true },
  options: { allowMixed: Severity.ALLOW },
})
export class TranscriptionJob {
  @prop({
    required: true,
    enum: TranscriptionJobStatus,
    default: TranscriptionJobStatus.queuedForDownload,
    index: true,
  })
  status: TranscriptionJobStatus
  @prop({ required: true, index: true })
  chatId: string
  @prop({ required: true })
  telegramChatId: string
  @prop()
  telegramChatType?: string
  @prop({ required: true })
  sourceMessageId: number
  @prop()
  statusMessageId?: number
  @prop()
  requestMessageId?: number
  @prop({ required: true })
  fileId: string
  @prop()
  fileUniqueId?: string
  @prop()
  filePath?: string
  @prop()
  localSourcePath?: string
  @prop()
  fileSize?: number
  @prop()
  mimeType?: string
  @prop()
  fileName?: string
  @prop({ required: true, enum: TranscriptionJobSourceKind })
  sourceKind: TranscriptionJobSourceKind
  @prop()
  sourceUrl?: string
  @prop()
  requestedByUserId?: string
  @prop()
  forwardedFromUserId?: string
  @prop()
  forwardedSenderName?: string
  @prop()
  uiLocale?: string
  @prop()
  recognitionLanguageHint?: string
  @prop({ index: true })
  workerId?: string
  @prop()
  claimedAt?: Date
  @prop()
  downloadedAt?: Date
  @prop()
  heartbeatAt?: Date
  @prop({ required: true, default: 0 })
  attempts: number
  @prop()
  lastError?: string
  @prop()
  resultText?: string
  @prop({ type: Schema.Types.Mixed })
  resultParts?: TranscriptionResultPart[]
  @prop()
  partialResultText?: string
  @prop({ type: Schema.Types.Mixed })
  partialResultParts?: TranscriptionResultPart[]
  @prop()
  lastProgressAt?: Date
  @prop()
  lastProgressPublishedAt?: Date
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
  @prop()
  failedAt?: Date
}

export const TranscriptionJobModel = getModelForClass(TranscriptionJob)
