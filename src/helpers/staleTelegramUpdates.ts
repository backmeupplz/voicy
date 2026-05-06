import { Message } from '@grammyjs/types'
import Context from '@/models/Context'

const DEFAULT_MAX_MESSAGE_AGE_SECONDS = 5 * 60
const STARTUP_CUTOFF_SECONDS = Math.floor(Date.now() / 1000)

type StaleTelegramMessageDecision = {
  ignore: boolean
  reason?: 'before_startup' | 'too_old'
  ageSeconds: number
}

type StaleTelegramMessageOptions = {
  nowSeconds?: number
  startupCutoffSeconds?: number
  maxAgeSeconds?: number
}

function parseBoolean(value: string | undefined, defaultValue: boolean) {
  if (value === undefined || value === '') {
    return defaultValue
  }
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

function configuredMaxMessageAgeSeconds() {
  const configured = Number(process.env.VOICY_MAX_TELEGRAM_UPDATE_AGE_SECONDS)
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_MAX_MESSAGE_AGE_SECONDS
  }
  return configured
}

function dropPendingUpdatesOnStartupEnabled() {
  return parseBoolean(process.env.VOICY_DROP_PENDING_UPDATES_ON_STARTUP, true)
}

function shouldIgnoreTelegramMessageUpdate(
  message: Pick<Message, 'date'>,
  options: StaleTelegramMessageOptions = {}
): StaleTelegramMessageDecision {
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000)
  const startupCutoffSeconds =
    options.startupCutoffSeconds ?? STARTUP_CUTOFF_SECONDS
  const maxAgeSeconds =
    options.maxAgeSeconds ?? configuredMaxMessageAgeSeconds()
  const ageSeconds = nowSeconds - message.date

  if (message.date < startupCutoffSeconds) {
    return { ignore: true, reason: 'before_startup', ageSeconds }
  }

  if (ageSeconds > maxAgeSeconds) {
    return { ignore: true, reason: 'too_old', ageSeconds }
  }

  return { ignore: false, ageSeconds }
}

function logIgnoredTelegramMessage(
  ctx: Context,
  decision: StaleTelegramMessageDecision
) {
  console.warn(
    JSON.stringify({
      event: 'telegram_message_update_ignored',
      reason: decision.reason,
      updateId: ctx.update.update_id,
      messageId: ctx.message?.message_id,
      messageDate: ctx.message?.date,
      ageSeconds: decision.ageSeconds,
      chatType: ctx.chat?.type,
    })
  )
}

async function dropPendingTelegramUpdatesBeforePolling(api: Context['api']) {
  if (!dropPendingUpdatesOnStartupEnabled()) {
    console.info('Telegram pending update drop on startup is disabled')
    return false
  }

  await api.deleteWebhook({ drop_pending_updates: true })
  console.info('Dropped Telegram pending updates before long polling startup')
  return true
}

export {
  STARTUP_CUTOFF_SECONDS,
  dropPendingTelegramUpdatesBeforePolling,
  dropPendingUpdatesOnStartupEnabled,
  shouldIgnoreTelegramMessageUpdate,
  logIgnoredTelegramMessage,
}
