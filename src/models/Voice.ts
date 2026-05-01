import { Chat } from '@/models/Chat'
import {
  Severity,
  getModelForClass,
  modelOptions,
  prop,
} from '@typegoose/typegoose'
import Engine from '@/helpers/engine/Engine'

@modelOptions({
  schemaOptions: { timestamps: true },
  options: { allowMixed: Severity.ALLOW },
})
export class Voice {
  @prop({ required: true })
  url: string
  @prop({ required: true, enum: Engine, default: Engine.wit })
  engine: Engine
  @prop()
  duration?: number
  @prop()
  language?: string
  @prop({ required: true, default: 'queued', index: true })
  status: 'queued' | 'claimed' | 'processing' | 'completed' | 'failed'
  @prop({ required: true, index: true })
  chatId: string
  @prop({ required: true })
  messageId: number
  @prop()
  ackMessageId?: number
  @prop({ required: true })
  fileId: string
  @prop()
  fileSize?: number
  @prop()
  mimeType?: string
  @prop()
  fileName?: string
  @prop({ required: true })
  sourceType: 'voice' | 'audio' | 'document' | 'video_note'
  @prop()
  requestedBy?: number
  @prop()
  forwardFromId?: number
  @prop()
  forwardSenderName?: string
  @prop()
  queuedAt?: Date
  @prop()
  claimedAt?: Date
  @prop()
  completedAt?: Date
  @prop()
  failedAt?: Date
  @prop()
  error?: string
  @prop()
  text?: string
  @prop()
  textWithTimecodes?: string[][]
  @prop()
  file?: string
}

export const VoiceModel = getModelForClass(Voice)

export function addQueuedVoice({
  url,
  chat,
  messageId,
  fileId,
  fileSize,
  mimeType,
  fileName,
  sourceType,
  requestedBy,
  forwardFromId,
  forwardSenderName,
}: {
  url: string
  chat: Chat
  messageId: number
  fileId: string
  fileSize?: number
  mimeType?: string
  fileName?: string
  sourceType: 'voice' | 'audio' | 'document' | 'video_note'
  requestedBy?: number
  forwardFromId?: number
  forwardSenderName?: string
}) {
  return VoiceModel.create({
    url,
    chatId: chat.id,
    messageId,
    fileId,
    fileSize,
    mimeType,
    fileName,
    sourceType,
    requestedBy,
    forwardFromId,
    forwardSenderName,
    status: 'queued',
    queuedAt: new Date(),
  })
}
