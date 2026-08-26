import type { i18n, Resource } from 'i18next'
import { initReactI18next } from 'react-i18next'

/** Language keys used by i18next resources, cookies, and the store. */
export const SUPPORTED_LOCALES = {
  en: {
    name: 'English',
    htmlLang: 'en-GB',
    flag: '🇬🇧',
  },
  fr: {
    name: 'Français',
    htmlLang: 'fr-FR',
    flag: '🇫🇷',
  },
} as const

export type SupportedLocale = keyof typeof SUPPORTED_LOCALES

export const SUPPORTED_LOCALE_KEYS = Object.keys(SUPPORTED_LOCALES) as SupportedLocale[]

export const DEFAULT_LOCALE: SupportedLocale = 'fr'
export const FALLBACK_LOCALE: SupportedLocale = 'fr'

export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return locale in SUPPORTED_LOCALES
}

/** Normalize `fr`, `fr-FR`, or unknown tags to a SupportedLocale key. */
export function normalizeLocale(locale: string | undefined | null): SupportedLocale {
  if (!locale) {
    return DEFAULT_LOCALE
  }

  if (isSupportedLocale(locale)) {
    return locale
  }

  const base = locale.split('-')[0]?.toLowerCase()
  if (base && isSupportedLocale(base)) {
    return base
  }

  return DEFAULT_LOCALE
}

export function getLocaleConfig(locale: string) {
  if (isSupportedLocale(locale)) {
    return SUPPORTED_LOCALES[locale]
  }

  return {
    name: locale.toUpperCase(),
    htmlLang: locale,
    flag: '🌐',
  }
}

/** BCP-47 tag for `<html lang>` / Intl — never pass this to i18next. */
export function getHtmlLang(locale: SupportedLocale): string {
  return SUPPORTED_LOCALES[locale].htmlLang
}

export async function initializeI18n(
  i18n: i18n,
  resources: Resource,
  lng: SupportedLocale = DEFAULT_LOCALE,
): Promise<void> {
  const i18nWithReact = i18n.use(initReactI18next)

  try {
    await i18nWithReact.init({
      resources,
      lng,
      fallbackLng: FALLBACK_LOCALE,
      supportedLngs: SUPPORTED_LOCALE_KEYS,
      load: 'languageOnly',
      nonExplicitSupportedLngs: true,
      interpolation: {
        escapeValue: false,
      },
      defaultNS: 'common',
      keySeparator: '.',
      nsSeparator: ':',
    })
  } catch (error) {
    console.error('Failed to initialize i18n:', error)
    await i18nWithReact.init({
      resources: {},
      lng,
      fallbackLng: FALLBACK_LOCALE,
      interpolation: {
        escapeValue: false,
      },
    })
  }
}
