import type Context from '@/models/Context'

type I18nReplacements = Record<string, string | number>

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
  return escapeTelegramMarkdownText(ctx.i18n.t(key, replacements))
}
