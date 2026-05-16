import {
  TranscriptionJobModel,
  activeTranscriptionJobStatuses,
} from '@/models/TranscriptionJob'

export enum TranscriptionAbuseLimitReason {
  chatQueueFull = 'chat_queue_full',
}

export interface TranscriptionAbuseLimitSettings {
  chatActiveJobLimit: number
}

export interface TranscriptionAbuseLimitResult {
  reason: TranscriptionAbuseLimitReason
  limit: number
  windowMs?: number
}

interface Counter {
  countDocuments(query: Record<string, unknown>): Promise<number>
}

interface CheckTranscriptionAbuseLimitOptions {
  chatId: string
  chatPaid?: boolean
  requesterPaid?: boolean
  settings?: TranscriptionAbuseLimitSettings
  counter?: Counter
}

export function transcriptionAbuseLimitSettings(
  env: NodeJS.ProcessEnv = process.env
): TranscriptionAbuseLimitSettings {
  return {
    chatActiveJobLimit: numberFromEnv(
      env.VOICY_TRANSCRIPTION_CHAT_ACTIVE_JOB_LIMIT,
      10
    ),
  }
}

export async function checkTranscriptionAbuseLimits({
  chatId,
  chatPaid = false,
  requesterPaid = false,
  settings = transcriptionAbuseLimitSettings(),
  counter = transcriptionJobCounter,
}: CheckTranscriptionAbuseLimitOptions): Promise<
  TranscriptionAbuseLimitResult | undefined
> {
  if (chatPaid || requesterPaid) {
    return undefined
  }

  if (settings.chatActiveJobLimit > 0) {
    const activeJobs = await counter.countDocuments({
      chatId,
      status: { $in: activeTranscriptionJobStatuses },
    })
    if (activeJobs >= settings.chatActiveJobLimit) {
      return {
        reason: TranscriptionAbuseLimitReason.chatQueueFull,
        limit: settings.chatActiveJobLimit,
      }
    }
  }

  return undefined
}

const transcriptionJobCounter: Counter = {
  countDocuments(query: Record<string, unknown>) {
    return TranscriptionJobModel.countDocuments(query).exec()
  },
}

function numberFromEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}
