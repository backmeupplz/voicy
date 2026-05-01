export type UiLanguage = {
  code: string
  name: string
}

export const uiLanguages: UiLanguage[] = [
  { code: 'en', name: 'English' },
  { code: 'ru', name: 'Русский' },
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
