import type { i18n } from 'i18next'
import { persistNSync } from 'persist-and-sync'
import { create } from 'zustand'

interface I18nStore {
  language: string
  setLanguage: (language: string) => void
}

export function createI18nStore(i18nInstance: i18n) {
  return create<I18nStore>()(
    persistNSync(
      set => ({
        language: i18nInstance.language,
        setLanguage: (language: string) => {
          i18nInstance.changeLanguage(language)
          set({ language })
        },
      }),
      {
        name: 'i18n',
      },
    ),
  )
}
