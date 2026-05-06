export type UiLanguage = {
  code: string
  name: string
}

export const uiLanguages: UiLanguage[] = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'uk', name: 'Українська' },
]

export function uiLanguageForTelegramCode(code?: string): UiLanguage {
  const locale = code?.split('-')[0].toLowerCase()
  return (
    uiLanguages.find((language) => language.code === locale) || uiLanguages[0]
  )
}

export function findUiLanguage(query: string): UiLanguage {
  const normalizedQuery = query.toLowerCase()
  return uiLanguages.find(
    (language) =>
      language.code.toLowerCase() === normalizedQuery ||
      language.name.toLowerCase().includes(normalizedQuery)
  )
}
