import { NextFunction } from 'grammy'
import { createHmac } from 'crypto'
import Context from '@/models/Context'
import axios from 'axios'

const DEFAULT_PROJECT = 'voicy'
const DEFAULT_SOURCE = 'bot'
const DEFAULT_TIMEOUT_MS = 750

type ActivityStreamEnv = NodeJS.ProcessEnv

type ActivityStreamConfig = {
  endpoint: string
  token: string
  project: string
  source: string
  timeoutMs: number
}

type ActivityEvent = {
  text: string
  project?: string
  source?: string
}

type ActivityEmitResult = {
  emitted: boolean
  reason?: string
  status?: number
  text?: string
}

type ActivityJob = {
  telegramChatId?: string
  chatId?: string
  sourceKind?: string
  attempts?: number
}

function firstConfigured(...values: Array<string | undefined>) {
  return values.find((value) => value?.trim())
}

function activityStreamUrl(env: ActivityStreamEnv = process.env) {
  return firstConfigured(
    env.VOICY_ACTIVITY_STREAM_URL,
    env.ACTIVITY_STREAM_URL,
    env.SYMPHONY_ACTIVITY_STREAM_URL
  )
}

function activityStreamToken(env: ActivityStreamEnv = process.env) {
  return firstConfigured(
    env.VOICY_ACTIVITY_STREAM_TOKEN,
    env.ACTIVITY_STREAM_TOKEN,
    env.SYMPHONY_ACTIVITY_TOKEN
  )
}

function activityStreamSecret(env: ActivityStreamEnv = process.env) {
  return firstConfigured(
    env.VOICY_ACTIVITY_STREAM_ANONYMIZATION_SECRET,
    activityStreamToken(env)
  )
}

function eventsEndpoint(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, '')
  if (trimmed.endsWith('/activity/v1/events')) {
    return trimmed
  }
  return `${trimmed}/activity/v1/events`
}

function numberFromEnv(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function activityStreamConfig(
  env: ActivityStreamEnv = process.env
): ActivityStreamConfig | undefined {
  const url = activityStreamUrl(env)
  const token = activityStreamToken(env)
  if (!url || !token) {
    return undefined
  }
  return {
    endpoint: eventsEndpoint(url),
    token,
    project: env.VOICY_ACTIVITY_STREAM_PROJECT || DEFAULT_PROJECT,
    source: env.VOICY_ACTIVITY_STREAM_SOURCE || DEFAULT_SOURCE,
    timeoutMs: numberFromEnv(
      env.VOICY_ACTIVITY_STREAM_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS
    ),
  }
}

export function anonymizeIdentifier(
  kind: 'chat' | 'user' | 'job',
  value: string | number | undefined,
  env: ActivityStreamEnv = process.env
) {
  const secret = activityStreamSecret(env)
  if (value === undefined || value === null || !secret) {
    return `${kind}:unknown`
  }

  const raw = String(value)
  const numeric = /^-?\d+$/.test(raw)
  const rawLength = raw.replace(/^-/, '').length
  const shape = numeric
    ? `${raw.startsWith('-') ? 'g' : 'u'}${rawLength}d`
    : `${raw.length}c`
  const digest = createHmac('sha256', secret)
    .update(`${kind}:${raw}`)
    .digest('hex')
    .slice(0, 10)

  return `${kind}:${shape}-${digest}`
}

export async function emitActivityEvent(
  event: ActivityEvent,
  env: ActivityStreamEnv = process.env
): Promise<ActivityEmitResult> {
  const config = activityStreamConfig(env)
  const text = event.text.trim()
  if (!config) {
    return { emitted: false, reason: 'not_configured', text }
  }
  if (!text) {
    return { emitted: false, reason: 'empty_text' }
  }

  try {
    const response = await axios.post(
      config.endpoint,
      {
        text,
        project: event.project || config.project,
        source: event.source || config.source,
      },
      {
        headers: { Authorization: `Bearer ${config.token}` },
        timeout: config.timeoutMs,
        validateStatus: (status) => status >= 200 && status < 300,
      }
    )
    return { emitted: true, status: response.status, text }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`Activity stream emit failed: ${message}`)
    return { emitted: false, reason: 'request_failed', text }
  }
}

function emitActivityEventInBackground(event: ActivityEvent) {
  void emitActivityEvent(event)
}

function chatLabelFromContext(ctx: Context) {
  return `Chat ${anonymizeIdentifier('chat', ctx.chat?.id)}`
}

function chatLabelFromJob(job: ActivityJob) {
  return `Chat ${anonymizeIdentifier('chat', job.telegramChatId || job.chatId)}`
}

function updateType(ctx: Context) {
  return (
    Object.keys(ctx.update || {}).find((key) => key !== 'update_id') ||
    'unknown'
  )
}

function messageType(ctx: Context) {
  const message = ctx.msg as unknown as Record<string, unknown> | undefined
  if (!message) {
    return updateType(ctx)
  }
  const knownMessageTypes = [
    'voice',
    'video_note',
    'audio',
    'document',
    'video',
    'text',
    'photo',
    'sticker',
    'animation',
    'contact',
    'location',
    'venue',
    'poll',
    'dice',
  ]
  return knownMessageTypes.find((type) => type in message) || 'message'
}

function commandName(ctx: Context) {
  const text = ctx.msg?.text
  if (!text?.startsWith('/')) {
    return undefined
  }
  const command = text.split(/\s+/, 1)[0]?.split('@', 1)[0]
  return command || undefined
}

export function activityTextForTelegramUpdate(ctx: Context) {
  return `${chatLabelFromContext(ctx)} received a ${messageType(ctx)} update`
}

export function activityTextForTelegramCommand(ctx: Context) {
  const command = commandName(ctx)
  if (!command) {
    return undefined
  }
  return `${chatLabelFromContext(ctx)} handled ${command}`
}

export function activityTextForTranscriptionQueued(
  ctx: Context,
  sourceKind?: string
) {
  const safeSourceKind = sourceKind || 'media'
  return `${chatLabelFromContext(ctx)} queued a ${safeSourceKind} transcription`
}

export function activityTextForWorkerJob(
  job: ActivityJob,
  action: 'started' | 'completed' | 'failed' | 'retrying'
) {
  const sourceKind = job.sourceKind || 'media'
  const attemptText = job.attempts ? ` after ${job.attempts} attempt(s)` : ''
  return `${chatLabelFromJob(
    job
  )} transcription ${sourceKind} job ${action}${attemptText}`
}

export function emitRuntimeActivity(text: string) {
  emitActivityEventInBackground({ text, source: 'runtime' })
}

export function emitTelegramUpdateReceived(ctx: Context) {
  emitActivityEventInBackground({ text: activityTextForTelegramUpdate(ctx) })
}

export function emitTranscriptionQueued(ctx: Context, sourceKind?: string) {
  emitActivityEventInBackground({
    text: activityTextForTranscriptionQueued(ctx, sourceKind),
  })
}

export function emitWorkerJobActivity(
  job: ActivityJob,
  action: 'started' | 'completed' | 'failed' | 'retrying'
) {
  emitActivityEventInBackground({
    text: activityTextForWorkerJob(job, action),
    source: 'worker',
  })
}

export default async function activityStreamMiddleware(
  ctx: Context,
  next: NextFunction
) {
  emitTelegramUpdateReceived(ctx)
  await next()
  const commandText = activityTextForTelegramCommand(ctx)
  if (commandText) {
    emitActivityEventInBackground({ text: commandText })
  }
}
