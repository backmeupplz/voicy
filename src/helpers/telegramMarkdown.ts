import type Context from '@/models/Context'

type I18nReplacements = Record<string, string | number>

function escapeTelegramHtmlReplacement(value: string | number) {
  return typeof value === 'string'
    ? value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    : value
}

function escapeTelegramMarkdownReplacement(value: string | number) {
  return typeof value === 'string'
    ? value.replace(/([*_`])/g, '\\$1').replace(/\[/g, '\\[')
    : value
}

function escapeTokenUnderscores(token: string) {
  let escaped = ''
  for (const character of token) {
    escaped += character === '_' ? '\\_' : character
  }
  return escaped
}

export function escapeTelegramMarkdownText(text: string) {
  return text
    .split(/(`[^`]*`)/g)
    .map((part) =>
      part.startsWith('`')
        ? part
        : part
            .replace(
              /(^|[^\\])(@[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+)/g,
              (_, prefix: string, token: string) =>
                `${prefix}${escapeTokenUnderscores(token)}`
            )
            .replace(
              /(^|[\s([{])(\/[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+)/g,
              (_, prefix: string, token: string) =>
                `${prefix}${escapeTokenUnderscores(token)}`
            )
    )
    .join('')
}

export function markdownI18n(
  ctx: Context,
  key: string,
  replacements?: I18nReplacements
) {
  const escapedReplacements = replacements
    ? Object.fromEntries(
        Object.entries(replacements).map(([replacementKey, value]) => [
          replacementKey,
          escapeTelegramMarkdownReplacement(value),
        ])
      )
    : undefined

  return escapeTelegramMarkdownText(ctx.i18n.t(key, escapedReplacements))
}

export function htmlI18n(
  ctx: Context,
  key: string,
  replacements?: I18nReplacements
) {
  const escapedReplacements = replacements
    ? Object.fromEntries(
        Object.entries(replacements).map(([replacementKey, value]) => [
          replacementKey,
          escapeTelegramHtmlReplacement(value),
        ])
      )
    : undefined

  return ctx.i18n.t(key, escapedReplacements)
}
