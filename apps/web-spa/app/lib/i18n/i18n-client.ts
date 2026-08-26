import { initializeI18n, normalizeLocale } from '@boilerstone/i18n/config'
import { getInitialLocale, setLocaleCookie } from '@boilerstone/i18n/cookies'
import i18n from '@boilerstone/i18n/instance'
import { createI18nStore, I18N_STORE_STORAGE_KEY } from '@boilerstone/i18n/store'
import { loadDynamicLocales } from '@boilerstone/i18n/utils'

const resources = loadDynamicLocales(
  import.meta.glob('./locales/*/*.locales.*.json', { eager: true }),
)

function readPersistedLanguage(): string | null {
  if (typeof localStorage === 'undefined') return null

  try {
    const stored = JSON.parse(localStorage.getItem(I18N_STORE_STORAGE_KEY) ?? 'null') as {
      language?: string
    } | null
    return stored?.language ?? null
  } catch {
    return null
  }
}

// localStorage → cookie / browser → default (normalize legacy BCP-47 like en-GB)
const initialLocale = normalizeLocale(readPersistedLanguage() ?? getInitialLocale())

// Rewrite normalized value before persistNSync rehydrates
if (typeof localStorage !== 'undefined') {
  localStorage.setItem(I18N_STORE_STORAGE_KEY, JSON.stringify({ language: initialLocale }))
}
setLocaleCookie(initialLocale)

export const useI18nStore = createI18nStore(i18n, initialLocale)

void initializeI18n(i18n, resources, initialLocale).then(() => {
  useI18nStore.getState().setLanguage(initialLocale)
})

export default i18n
