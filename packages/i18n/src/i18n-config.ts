import type { i18n, Resource } from 'i18next'
import { initReactI18next } from 'react-i18next'

// Supported locales configuration
export const SUPPORTED_LOCALES = {
  en: {
    name: 'English',
    defaultLocale: 'en-GB',
    flag: '🇬🇧',
  },
  fr: {
    name: 'Français',
    defaultLocale: 'fr-FR',
    flag: '🇫🇷',
  },
} as const

export type SupportedLocale = keyof typeof SUPPORTED_LOCALES
export type DefaultLocale = (typeof SUPPORTED_LOCALES)[SupportedLocale]['defaultLocale']

// Default locale configuration
export const DEFAULT_LOCALE = 'fr-FR'
export const FALLBACK_LOCALE = 'fr-FR'

// Get locale configuration dynamically
export function getLocaleConfig(locale: string) {
  return SUPPORTED_LOCALES[locale as SupportedLocale] || {
    name: locale.toUpperCase(),
    defaultLocale: locale,
    flag: '🌐',
  }
}

// Initialize i18n
export async function initializeI18n(i18n: i18n, resources: Resource): Promise<void> {
  try {
    await i18n
      .use(initReactI18next)
      .init({
        resources,
        lng: DEFAULT_LOCALE,
        fallbackLng: FALLBACK_LOCALE,
        interpolation: {
          escapeValue: false,
        },
        defaultNS: 'common',
        keySeparator: '.',
        nsSeparator: ':',
      })
  }
  catch (error) {
    console.error('Failed to initialize i18n:', error)
    // Fallback with minimal configuration
    await i18n
      .use(initReactI18next)
      .init({
        resources: {},
        lng: DEFAULT_LOCALE,
        fallbackLng: FALLBACK_LOCALE,
        interpolation: {
          escapeValue: false,
        },
      })
  }
}
