import { uiLanguages } from '@/helpers/language/uiLanguages'
import i18n from '@/helpers/i18n'

const supportedLocaleCodes = new Set(
  uiLanguages.map((language) => language.code)
)

function supportedLocale(locale?: string) {
  return locale && supportedLocaleCodes.has(locale) ? locale : 'en'
}

export default function localizedTranscriptionText(
  locale: string | undefined,
  key: string
) {
  return i18n.t(supportedLocale(locale), key)
}
