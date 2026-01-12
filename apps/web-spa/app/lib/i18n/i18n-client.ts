import { initializeI18n } from '@boilerstone/i18n/config'
import i18n from '@boilerstone/i18n/instance'
import { createI18nStore } from '@boilerstone/i18n/store'
import { loadDynamicLocales } from '@boilerstone/i18n/utils'

// Dynamically load all locale files from web-app
const allModules = import.meta.glob('./locales/*/*.locales.*.json', { eager: true })

// Load all locales dynamically and merge with editor locales
const webAppResources = loadDynamicLocales(allModules)

// Merge web-app and editor resources
const resources = {
  ...webAppResources,
}

// Merge editor namespace into each locale
Object.keys(webAppResources).forEach((locale) => {
  if (!resources[locale]) {
    resources[locale] = {}
  }
  Object.assign(resources[locale], webAppResources[locale])
})

initializeI18n(i18n, resources)

export const useI18nStore = createI18nStore(i18n)

export default i18n
