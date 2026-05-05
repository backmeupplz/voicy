export const telegramBotTokenUrlPattern =
  /\/(?:file\/)?bot\d+:[A-Za-z0-9_-]+(?=\/|\?|$)/

export function containsTelegramBotTokenUrl(value?: string) {
  return Boolean(value && telegramBotTokenUrlPattern.test(value))
}

export function safeWorkerSourceUrl(value?: string) {
  return containsTelegramBotTokenUrl(value) ? undefined : value
}
