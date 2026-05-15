import {
  TranscriptionJobModel,
  activeTranscriptionJobStatuses,
} from '@/models/TranscriptionJob'

export enum TranscriptionAbuseLimitReason {
  chatQueueFull = 'chat_queue_full',
  chatRateLimited = 'chat_rate_limited',
  userRateLimited = 'user_rate_limited',
}

export interface TranscriptionAbuseLimitSettings {
  chatActiveJobLimit: number
  chatWindowMs: number
  chatWindowJobLimit: number
  userWindowMs: number
  userWindowJobLimit: number
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
  userId?: string
  now?: Date
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
    chatWindowMs: numberFromEnv(
      env.VOICY_TRANSCRIPTION_CHAT_WINDOW_MS,
      10 * 60 * 1000
    ),
    chatWindowJobLimit: numberFromEnv(
      env.VOICY_TRANSCRIPTION_CHAT_WINDOW_JOB_LIMIT,
      20
    ),
    userWindowMs: numberFromEnv(
      env.VOICY_TRANSCRIPTION_USER_WINDOW_MS,
      10 * 60 * 1000
    ),
    userWindowJobLimit: numberFromEnv(
      env.VOICY_TRANSCRIPTION_USER_WINDOW_JOB_LIMIT,
      5
    ),
  }
}

export async function checkTranscriptionAbuseLimits({
  chatId,
  chatPaid = false,
  userId,
  now = new Date(),
  settings = transcriptionAbuseLimitSettings(),
  counter = transcriptionJobCounter,
}: CheckTranscriptionAbuseLimitOptions): Promise<
  TranscriptionAbuseLimitResult | undefined
> {
  if (chatPaid) {
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

  if (settings.chatWindowJobLimit > 0 && settings.chatWindowMs > 0) {
    const chatWindowJobs = await counter.countDocuments({
      chatId,
      createdAt: { $gte: windowStart(now, settings.chatWindowMs) },
    })
    if (chatWindowJobs >= settings.chatWindowJobLimit) {
      return {
        reason: TranscriptionAbuseLimitReason.chatRateLimited,
        limit: settings.chatWindowJobLimit,
        windowMs: settings.chatWindowMs,
      }
    }
  }

  if (userId && settings.userWindowJobLimit > 0 && settings.userWindowMs > 0) {
    const userWindowJobs = await counter.countDocuments({
      requestedByUserId: userId,
      createdAt: { $gte: windowStart(now, settings.userWindowMs) },
    })
    if (userWindowJobs >= settings.userWindowJobLimit) {
      return {
        reason: TranscriptionAbuseLimitReason.userRateLimited,
        limit: settings.userWindowJobLimit,
        windowMs: settings.userWindowMs,
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

function windowStart(now: Date, windowMs: number) {
  return new Date(now.getTime() - windowMs)
}
