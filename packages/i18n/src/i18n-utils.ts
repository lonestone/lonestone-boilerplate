import type { Resource, ResourceLanguage } from 'i18next'
import type { SupportedLocale } from './i18n-config'

// Extract filename from path
function extractFileName(path: string): string | null {
  // Handle both Windows and Unix path separators
  const normalizedPath = path.replace(/\\/g, '/')
  const fileName = normalizedPath.split('/').pop()?.replace(/\.locales\.[a-z]{2}\.json$/, '')
  return fileName || null
}

// Extract locale from path (e.g., './locales/fr/auth.locales.fr.json' -> 'fr')
function extractLocaleFromPath(path: string): string | null {
  const normalizedPath = path.replace(/\\/g, '/')
  const match = normalizedPath.match(/\.locales\.([a-z]{2})\.json$/)
  return match ? match[1] as SupportedLocale : null
}

// Load locale modules for a given language
export function extractLocaleModules(modules: Record<string, unknown>) {
  const resources: Record<string, Record<string, string>> = {}

  Object.entries(modules).forEach(([path, module]) => {
    const fileName = extractFileName(path)

    if (fileName && module && typeof module === 'object' && module !== null) {
      // For JSON files, the module is the content directly, not wrapped in a default export
      if (typeof module === 'object' && module !== null) {
        resources[fileName] = module as Record<string, string>
      }
    }
  })

  return resources
}

// Dynamically extract locales from glob pattern
export function extractAvailableLocales(modules: Record<string, unknown>): string[] {
  const locales = new Set<string>()

  Object.keys(modules).forEach((path) => {
    const locale = extractLocaleFromPath(path)
    if (locale) {
      locales.add(locale)
    }
  })

  return Array.from(locales).sort()
}

// Group modules by locale dynamically
export function groupModulesByLocale(modules: Record<string, unknown>): Record<string, Record<string, unknown>> {
  const grouped: Record<string, Record<string, unknown>> = {}

  Object.entries(modules).forEach(([path, module]) => {
    const locale = extractLocaleFromPath(path)
    if (locale) {
      if (!grouped[locale]) {
        grouped[locale] = {}
      }
      grouped[locale][path] = module
    }
  })

  return grouped
}

export function modulesToResources(modules: Record<string, Record<string, unknown>>): Resource {
  const resources: Record<string, ResourceLanguage> = {}

  for (const [locale, data] of Object.entries(modules)) {
    try {
      resources[locale] = extractLocaleModules(data)
    }
    catch (error) {
      console.error(`Failed to load locale modules for ${locale}:`, error)
      resources[locale] = {}
    }
  }

  return resources
}

// Dynamic locale loader - single function to handle all locale loading
export function loadDynamicLocales(allModules: Record<string, unknown>): Resource {
  // Group modules by locale automatically
  const groupedModules = groupModulesByLocale(allModules)

  // Convert to resources
  return modulesToResources(groupedModules)
}
