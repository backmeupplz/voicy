import { DocumentType } from '@typegoose/typegoose'
import {
  TranscriptionJob,
  TranscriptionJobModel,
  TranscriptionJobStatus,
  TranscriptionResultPart,
  WorkerEngineMetadata,
} from '@/models/TranscriptionJob'
import { Types } from 'mongoose'
import { WorkerClient, WorkerClientModel } from '@/models/WorkerClient'
import publishCompletedTranscriptionJob from '@/helpers/transcriptionJobs/publishCompletedTranscriptionJob'
import publishTranscriptionJobProgress from '@/helpers/transcriptionJobs/publishTranscriptionJobProgress'

const MAX_RESULT_TEXT_LENGTH = 100000
const MAX_RESULT_PARTS = 5000

type TimestampedJob = DocumentType<TranscriptionJob> & {
  createdAt?: Date
  updatedAt?: Date
}

export class WorkerApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string) {
    super(code)
    this.status = status
    this.code = code
  }
}

function workerId(workerClient: DocumentType<WorkerClient>) {
  return workerClient._id.toString()
}

function assertObjectId(id: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw new WorkerApiError(400, 'invalid_job_id')
  }
}

function truncateError(error: unknown) {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
      ? error.message
      : 'Unknown worker error'
  return message.slice(0, 2000)
}

function maxAttempts() {
  const configured = Number(process.env.VOICY_WORKER_MAX_ATTEMPTS || 3)
  return Number.isFinite(configured) && configured > 0 ? configured : 3
}

function validateResultText(text: unknown) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new WorkerApiError(400, 'result_text_required')
  }
  if (text.length > MAX_RESULT_TEXT_LENGTH) {
    throw new WorkerApiError(400, 'result_text_too_large')
  }
  return text
}

function validateProgressText(text: unknown) {
  if (text === undefined) {
    return undefined
  }
  if (typeof text !== 'string') {
    throw new WorkerApiError(400, 'invalid_progress_text')
  }
  if (text.length > MAX_RESULT_TEXT_LENGTH) {
    throw new WorkerApiError(400, 'progress_text_too_large')
  }
  return text
}

function validateResultParts(parts: unknown): TranscriptionResultPart[] {
  if (parts === undefined) {
    return undefined
  }
  if (!Array.isArray(parts) || parts.length > MAX_RESULT_PARTS) {
    throw new WorkerApiError(400, 'invalid_result_parts')
  }
  return parts.map((part) => {
    if (!part || typeof part !== 'object') {
      throw new WorkerApiError(400, 'invalid_result_part')
    }
    const { timeCode, text } = part as TranscriptionResultPart
    if (timeCode !== undefined && typeof timeCode !== 'string') {
      throw new WorkerApiError(400, 'invalid_result_part_timecode')
    }
    if (typeof text !== 'string') {
      throw new WorkerApiError(400, 'invalid_result_part_text')
    }
    return { timeCode, text }
  })
}

function validateOptionalString(value: unknown, code: string) {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'string') {
    throw new WorkerApiError(400, code)
  }
  return value
}

function validateDuration(value: unknown) {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new WorkerApiError(400, 'invalid_duration')
  }
  return value
}

function validateEngineMetadata(value: unknown): WorkerEngineMetadata {
  if (value === undefined) {
    return undefined
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new WorkerApiError(400, 'invalid_engine_metadata')
  }
  return value as WorkerEngineMetadata
}

export function serializeJob(job: DocumentType<TranscriptionJob>) {
  const timestampedJob = job as TimestampedJob
  return {
    id: job._id.toString(),
    status: job.status,
    chatId: job.chatId,
    telegramChatId: job.telegramChatId,
    telegramChatType: job.telegramChatType,
    sourceMessageId: job.sourceMessageId,
    statusMessageId: job.statusMessageId,
    requestMessageId: job.requestMessageId,
    fileId: job.fileId,
    fileUniqueId: job.fileUniqueId,
    filePath: job.filePath,
    fileSize: job.fileSize,
    mimeType: job.mimeType,
    fileName: job.fileName,
    sourceKind: job.sourceKind,
    sourceUrl: job.sourceUrl,
    requestedByUserId: job.requestedByUserId,
    forwardedFromUserId: job.forwardedFromUserId,
    forwardedSenderName: job.forwardedSenderName,
    recognitionLanguageHint: job.recognitionLanguageHint,
    partialResultText: job.partialResultText,
    lastProgressAt: job.lastProgressAt,
    lastProgressPublishedAt: job.lastProgressPublishedAt,
    attempts: job.attempts,
    claimedAt: job.claimedAt,
    heartbeatAt: job.heartbeatAt,
    createdAt: timestampedJob.createdAt,
    updatedAt: timestampedJob.updatedAt,
  }
}

export async function claimNextJob(workerClient: DocumentType<WorkerClient>) {
  const now = new Date()
  const job = await TranscriptionJobModel.findOneAndUpdate(
    { status: TranscriptionJobStatus.queued },
    {
      $set: {
        status: TranscriptionJobStatus.processing,
        workerId: workerId(workerClient),
        claimedAt: now,
        heartbeatAt: now,
      },
      $inc: { attempts: 1 },
    },
    { sort: { createdAt: 1 }, new: true }
  )

  if (job) {
    await WorkerClientModel.updateOne(
      { _id: workerClient._id },
      { $set: { lastClaimedAt: now } }
    )
    publishTranscriptionJobProgress(job, 'processing').catch((error) =>
      console.error('Failed to publish transcription job start', error)
    )
  }

  return job
}

export async function getOwnedJob(
  jobId: string,
  workerClient: DocumentType<WorkerClient>
) {
  assertObjectId(jobId)
  const job = await TranscriptionJobModel.findOne({
    _id: jobId,
    workerId: workerId(workerClient),
    status: TranscriptionJobStatus.processing,
  })
  if (!job) {
    throw new WorkerApiError(404, 'job_not_found')
  }
  return job
}

export async function heartbeatJob(
  jobId: string,
  workerClient: DocumentType<WorkerClient>
) {
  assertObjectId(jobId)
  const job = await TranscriptionJobModel.findOneAndUpdate(
    {
      _id: jobId,
      workerId: workerId(workerClient),
      status: TranscriptionJobStatus.processing,
    },
    { $set: { heartbeatAt: new Date() } },
    { new: true }
  )
  if (!job) {
    throw new WorkerApiError(404, 'job_not_found')
  }
  return job
}

export async function updateJobProgress(
  jobId: string,
  workerClient: DocumentType<WorkerClient>,
  body: Record<string, unknown>
) {
  assertObjectId(jobId)
  const partialResultText = validateProgressText(body.text)
  const partialResultParts = validateResultParts(body.parts)
  if (!partialResultText?.trim() && !partialResultParts?.length) {
    throw new WorkerApiError(400, 'progress_text_required')
  }
  const recognitionLanguage = validateOptionalString(
    body.language,
    'invalid_language'
  )
  const workerEngine = validateOptionalString(body.engine, 'invalid_engine')
  const duration = validateDuration(body.duration)
  const workerEngineMetadata = validateEngineMetadata(body.metadata)
  const now = new Date()
  const job = await TranscriptionJobModel.findOneAndUpdate(
    {
      _id: jobId,
      workerId: workerId(workerClient),
      status: TranscriptionJobStatus.processing,
    },
    {
      $set: {
        partialResultText,
        partialResultParts,
        recognitionLanguage,
        workerEngine,
        duration,
        workerEngineMetadata,
        heartbeatAt: now,
        lastProgressAt: now,
      },
    },
    { new: true }
  )
  if (!job) {
    throw new WorkerApiError(404, 'job_not_found')
  }

  try {
    await publishTranscriptionJobProgress(job, 'partial')
  } catch (error) {
    console.error('Failed to publish transcription job progress', error)
  }
  return job
}

export async function completeJob(
  jobId: string,
  workerClient: DocumentType<WorkerClient>,
  body: Record<string, unknown>
) {
  assertObjectId(jobId)
  const resultText = validateResultText(body.text)
  const resultParts = validateResultParts(body.parts)
  const recognitionLanguage = validateOptionalString(
    body.language,
    'invalid_language'
  )
  const workerEngine = validateOptionalString(body.engine, 'invalid_engine')
  const duration = validateDuration(body.duration)
  const workerEngineMetadata = validateEngineMetadata(body.metadata)
  const now = new Date()
  const job = await TranscriptionJobModel.findOneAndUpdate(
    {
      _id: jobId,
      workerId: workerId(workerClient),
      status: TranscriptionJobStatus.processing,
    },
    {
      $set: {
        status: TranscriptionJobStatus.completed,
        resultText,
        resultParts,
        recognitionLanguage,
        workerEngine,
        duration,
        workerEngineMetadata,
        heartbeatAt: now,
        completedAt: now,
      },
      $unset: { lastError: '' },
    },
    { new: true }
  )
  if (!job) {
    throw new WorkerApiError(404, 'job_not_found')
  }

  try {
    await publishCompletedTranscriptionJob(job)
  } catch (error) {
    console.error('Failed to publish completed transcription job', error)
  }
  return job
}

export async function failJob(
  jobId: string,
  workerClient: DocumentType<WorkerClient>,
  body: Record<string, unknown>
) {
  assertObjectId(jobId)
  const retryable =
    body.retryable === undefined ? true : Boolean(body.retryable)
  const now = new Date()
  const currentJob = await getOwnedJob(jobId, workerClient)
  const shouldRetry = retryable && currentJob.attempts < maxAttempts()
  const update = shouldRetry
    ? {
        $set: {
          status: TranscriptionJobStatus.queued,
          lastError: truncateError(body.error),
        },
        $unset: { workerId: '', claimedAt: '', heartbeatAt: '' },
      }
    : {
        $set: {
          status: TranscriptionJobStatus.failed,
          lastError: truncateError(body.error),
          heartbeatAt: now,
          failedAt: now,
        },
      }

  const job = await TranscriptionJobModel.findOneAndUpdate(
    {
      _id: jobId,
      workerId: workerId(workerClient),
      status: TranscriptionJobStatus.processing,
    },
    update,
    { new: true }
  )
  if (!job) {
    throw new WorkerApiError(404, 'job_not_found')
  }
  publishTranscriptionJobProgress(job, shouldRetry ? 'retrying' : 'failed', {
    force: true,
  }).catch((error) =>
    console.error('Failed to publish transcription job failure', error)
  )
  return job
}
