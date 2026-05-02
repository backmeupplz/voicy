export const DEFAULT_PROGRESS_EDIT_INTERVAL_MS = 2500
export const MIN_PROGRESS_EDIT_INTERVAL_MS = 1000

export function progressEditIntervalMs(env: NodeJS.ProcessEnv = process.env) {
  const configured = Number(env.VOICY_PROGRESS_EDIT_INTERVAL_MS)
  if (!Number.isFinite(configured)) {
    return DEFAULT_PROGRESS_EDIT_INTERVAL_MS
  }
  return Math.max(configured, MIN_PROGRESS_EDIT_INTERVAL_MS)
}

export function liveProgressAllowedForChatType(chatType?: string) {
  return chatType !== 'channel'
}

export function shouldThrottleProgressPublish({
  force = false,
  intervalMs = progressEditIntervalMs(),
  lastPublishedAt,
  now = new Date(),
}: {
  force?: boolean
  intervalMs?: number
  lastPublishedAt?: Date
  now?: Date
}) {
  if (force || !lastPublishedAt) {
    return false
  }

  return now.getTime() - lastPublishedAt.getTime() < intervalMs
}
