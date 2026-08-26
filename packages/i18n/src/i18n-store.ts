import type { i18n } from 'i18next'
import type { SupportedLocale } from './i18n-config'
import { persistNSync } from 'persist-and-sync'
import { create } from 'zustand'
import { normalizeLocale } from './i18n-config'
import { setLocaleCookie } from './i18n-cookies'

export const I18N_STORE_STORAGE_KEY = 'i18n'

interface I18nStore {
  language: SupportedLocale
  setLanguage: (language: SupportedLocale | string) => void
}

export function createI18nStore(i18nInstance: i18n, initialLanguage?: SupportedLocale) {
  const startingLanguage = normalizeLocale(initialLanguage ?? i18nInstance.language)

  const store = create<I18nStore>()(
    persistNSync(
      (set) => ({
        language: startingLanguage,
        setLanguage: (language: SupportedLocale | string) => {
          const locale = normalizeLocale(language)
          void i18nInstance.changeLanguage(locale)
          setLocaleCookie(locale)
          set({ language: locale })
        },
      }),
      {
        name: I18N_STORE_STORAGE_KEY,
        // Avoid flash of default locale before localStorage rehydrate
        initDelay: 0,
      },
    ),
  )

  // persistNSync rehydrates via raw set(); normalize legacy BCP-47 values (en-GB → en)
  if (typeof window !== 'undefined') {
    queueMicrotask(() => {
      const current = store.getState().language
      const normalized = normalizeLocale(current)
      if (current !== normalized) {
        store.getState().setLanguage(normalized)
      }
    })
  }

  return store
}
