import i18n from '@/helpers/i18n'

function supportedLocale(locale?: string) {
  return locale === 'ru' ? 'ru' : 'en'
}

export default function localizedTranscriptionText(
  locale: string | undefined,
  key: string
) {
  return i18n.t(supportedLocale(locale), key)
}
