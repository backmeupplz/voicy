import { Transformer } from 'grammy'
import { autoRetry } from '@grammyjs/auto-retry'

type ApiConfig = {
  use: (...transformers: Transformer[]) => unknown
}

type Env = NodeJS.ProcessEnv

interface TelegramApiResponse {
  ok: boolean
  error_code?: number
  parameters?: {
    retry_after?: number
  }
}

const DEFAULT_MAX_RETRY_ATTEMPTS = 3
const DEFAULT_MAX_RETRY_AFTER_SECONDS = 120

function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback
  }

  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function telegramApiRetryOptions(env: Env = process.env) {
  return {
    maxRetryAttempts: positiveInteger(
      env.VOICY_TELEGRAM_API_MAX_RETRY_ATTEMPTS,
      DEFAULT_MAX_RETRY_ATTEMPTS
    ),
    maxDelaySeconds: positiveInteger(
      env.VOICY_TELEGRAM_API_MAX_RETRY_AFTER_SECONDS,
      DEFAULT_MAX_RETRY_AFTER_SECONDS
    ),
  }
}

function telegramApiRetryLogger(
  options = telegramApiRetryOptions()
): Transformer {
  return async (prev, method, payload, signal) => {
    const result = await prev(method, payload, signal)
    const response = result as TelegramApiResponse
    const retryAfterSeconds = response.parameters?.retry_after

    if (typeof retryAfterSeconds === 'number') {
      console.warn('Telegram API rate limit received', {
        method,
        retryAfterSeconds,
        willAutoRetry: retryAfterSeconds <= options.maxDelaySeconds,
      })
    }

    return result
  }
}

export default function configureTelegramApiRetry(apiConfig: ApiConfig) {
  const options = telegramApiRetryOptions()
  apiConfig.use(
    telegramApiRetryLogger(options),
    autoRetry(options) as Transformer
  )
}

export { telegramApiRetryLogger, telegramApiRetryOptions }
