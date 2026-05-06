import Context from '@/models/Context'

interface ExtraErrorInfo {
  ctx?: Context
  location?: string
  jobId?: string
  meta?: Record<string, boolean | number | string | null | undefined>
}

interface RedactedErrorInfo {
  location?: string
  error: {
    name: string
    message: string
    stack?: string
  }
  context?: {
    updateId?: number
    updateType?: string
    chatId?: string
    chatType?: string
    userId?: string
    messageType?: string
    command?: string
  }
  jobId?: string
  meta?: ExtraErrorInfo['meta']
}

export default function report(error: unknown, info: ExtraErrorInfo = {}) {
  console.error(sanitizeErrorReport(error, info))
}

function sanitizeErrorReport(
  error: unknown,
  info: ExtraErrorInfo = {}
): RedactedErrorInfo {
  const report: RedactedErrorInfo = {
    location: info.location,
    error: sanitizeError(error),
    context: sanitizeContext(info.ctx),
    jobId: info.jobId,
    meta: sanitizeMeta(info.meta),
  }

  return compactObject(report) as RedactedErrorInfo
}

function sanitizeError(error: unknown): RedactedErrorInfo['error'] {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: redactSensitiveText(error.message),
      stack: error.stack ? redactSensitiveText(error.stack) : undefined,
    }
  }

  return {
    name: typeof error,
    message: redactSensitiveText(String(error)),
  }
}

function sanitizeContext(ctx?: Context): RedactedErrorInfo['context'] {
  if (!ctx) {
    return undefined
  }

  return compactObject({
    updateId: ctx.update?.update_id,
    updateType: updateType(ctx.update),
    chatId: ctx.chat?.id ? String(ctx.chat.id) : undefined,
    chatType: ctx.chat?.type,
    userId: ctx.from?.id ? String(ctx.from.id) : undefined,
    messageType: ctx.msg ? messageType(ctx.msg) : undefined,
    command: commandName(ctx.msg?.text),
  })
}

function updateType(update?: Context['update']) {
  if (!update) {
    return undefined
  }

  return Object.keys(update).find((key) => key !== 'update_id')
}

function messageType(message: Context['msg']) {
  if (!message) {
    return undefined
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

  return knownMessageTypes.find((type) => type in message) || 'unknown'
}

function commandName(text?: string) {
  if (!text?.startsWith('/')) {
    return undefined
  }

  const command = text.split(/\s+/, 1)[0]?.split('@', 1)[0]
  return command || undefined
}

function redactSensitiveText(value: string) {
  return value
    .replace(
      /(\/(?:file\/)?bot)\d+:[A-Za-z0-9_-]+(?=\/|\?|$)/g,
      '$1[redacted-telegram-token]'
    )
    .replace(/\b\d{5,}:[A-Za-z0-9_-]{20,}\b/g, '[redacted-telegram-token]')
    .replace(
      /\b(?:Bearer|Token|Authorization|Api-Key)\s+[^,\s)]+/gi,
      '[redacted-secret]'
    )
    .replace(/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]+/g, '[redacted-stripe-key]')
    .replace(/\bwhsec_[A-Za-z0-9]+/g, '[redacted-stripe-secret]')
    .replace(
      /(mongodb(?:\+srv)?:\/\/[^:\s/@]+:)[^@\s]+(@)/gi,
      '$1[redacted-password]$2'
    )
    .replace(
      /(\b[a-z][a-z0-9+.-]*:\/\/[^:/\s@]+:)[^@\s/]+(@)/gi,
      '$1[redacted-password]$2'
    )
    .replace(
      /([?&](?:token|key|secret|password|signature|api_hash)=)[^&\s]+/gi,
      '$1[redacted]'
    )
    .replace(
      /(^|[\s(["'])(\/(?:Users|home|tmp|var|private|Volumes)\/[^\s,)"']+)/g,
      '$1[redacted-local-path]'
    )
    .replace(/(^|[\s(["'])([A-Za-z]:\\[^\s,)"']+)/g, '$1[redacted-local-path]')
}

function sanitizeMeta(meta?: ExtraErrorInfo['meta']) {
  if (!meta) {
    return undefined
  }

  return Object.keys(meta).reduce((result, key) => {
    const value = meta[key]
    result[key] = typeof value === 'string' ? redactSensitiveText(value) : value
    return result
  }, {} as ExtraErrorInfo['meta'])
}

function compactObject<T extends object>(value: T) {
  return Object.keys(value).reduce((result, key) => {
    const typedKey = key as keyof T
    const entry = value[typedKey]
    if (entry !== undefined) {
      result[typedKey] = entry
    }
    return result
  }, {} as Partial<T>)
}

export { redactSensitiveText, sanitizeErrorReport }
