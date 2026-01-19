/* eslint-disable node/prefer-global/process */
import type { SupportedLocale } from './i18n-config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { glob } from 'glob'
import { SUPPORTED_LOCALES } from './i18n-config'

const SUPPORTED_LOCALE_KEYS = Object.keys(SUPPORTED_LOCALES) as SupportedLocale[]

interface TranslationObject {
  [key: string]: string | TranslationObject | string[]
}

interface MissingKeysReport {
  locale: string
  namespace: string
  keys: string[]
}

interface OrphanedKeysReport {
  locale: string
  namespace: string
  keys: string[]
}

/**
 * Recursively finds keys that exist in base but are missing in target.
 * Returns an array of dot-notation key paths.
 */
function findMissingKeys(
  base: TranslationObject,
  target: TranslationObject,
  prefix = '',
): string[] {
  const missingKeys: string[] = []

  for (const key of Object.keys(base)) {
    const baseVal = base[key]
    const targetVal = target[key]
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (!(key in target)) {
      // Key is completely missing in target
      missingKeys.push(fullKey)
    }
    else if (
      typeof baseVal === 'object'
      && baseVal !== null
      && !Array.isArray(baseVal)
      && typeof targetVal === 'object'
      && targetVal !== null
      && !Array.isArray(targetVal)
    ) {
      // Both are objects, recurse
      missingKeys.push(
        ...findMissingKeys(baseVal as TranslationObject, targetVal as TranslationObject, fullKey),
      )
    }
    else if (
      typeof baseVal === 'object'
      && baseVal !== null
      && !Array.isArray(baseVal)
      && typeof targetVal === 'string'
    ) {
      // Base is an object but target is a string - structure mismatch, report as missing
      missingKeys.push(fullKey)
    }
  }

  return missingKeys
}

function getDirname(metaUrl: string) {
  return path.dirname(fileURLToPath(metaUrl))
}

type LocalesData = Record<SupportedLocale, Record<string, Record<string, unknown>>>

function loadLocalesForLocale(localesDir: string, locale: SupportedLocale): Record<string, Record<string, unknown>> {
  const localeDir = path.join(localesDir, locale)
  const result: Record<string, Record<string, unknown>> = {}

  if (!fs.existsSync(localeDir)) {
    return result
  }

  const files = fs.readdirSync(localeDir).filter(file => file.endsWith(`.locales.${locale}.json`))
  for (const file of files) {
    const namespace = file.replace(`.locales.${locale}.json`, '')
    const filePath = path.join(localeDir, file)
    const content = fs.readFileSync(filePath, 'utf-8')
    result[namespace] = JSON.parse(content)
  }

  return result
}

function loadLocalesForDirectory(localesDir: string): LocalesData {
  const result = {} as LocalesData

  for (const locale of SUPPORTED_LOCALE_KEYS) {
    result[locale] = loadLocalesForLocale(localesDir, locale)
  }

  return result
}

function generateI18nextTypes(localesDir: string, namespaces: string[]) {
  // The i18next.d.ts file should be placed in the parent directory of locales (where i18n config lives)
  const i18nDir = path.dirname(localesDir)
  const typesFilePath = path.join(i18nDir, 'i18next.d.ts')

  if (namespaces.length === 0) {
    console.warn(`   ⚠️  No namespaces to generate types for`)
    return
  }

  // Generate imports
  const imports = namespaces
    .map(ns => `import type ${ns}En from './locales/en/${ns}.locales.en.json'`)
    .join('\n')

  // Generate resources object entries
  const resourceEntries = namespaces
    .map(ns => `      ${ns}: typeof ${ns}En`)
    .join('\n')

  const content = `${imports}

import 'i18next'

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: {
${resourceEntries}
    }
  }
}
`

  fs.writeFileSync(typesFilePath, content, 'utf-8')
  console.warn(`   📝 Generated ${path.relative(path.resolve(localesDir, '../..'), typesFilePath)}`)
}

interface CheckResult {
  missingKeys: MissingKeysReport[]
  orphanedKeys: OrphanedKeysReport[]
}

/**
 * Check translations for a directory and report missing/orphaned keys.
 * Returns missing keys (in en but not in other langs) and orphaned keys (in other langs but not in en).
 */
async function checkTranslationsForDirectory(localesDir: string): Promise<CheckResult> {
  console.warn(`\n🔍 Checking translations for: ${localesDir}`)

  const resources = loadLocalesForDirectory(localesDir) as Record<string, Record<string, TranslationObject>>

  const languages = Object.keys(resources)

  // Get all unique namespaces from all languages
  const allNamespaces = new Set<string>()
  for (const lang of languages) {
    const langNamespaces = Object.keys(resources[lang] || {})
    langNamespaces.forEach(namespace => allNamespaces.add(namespace))
  }

  const namespaces = Array.from(allNamespaces).sort()

  if (namespaces.length === 0) {
    console.warn(`   ⚠️  No namespaces found in ${localesDir}`)
    return { missingKeys: [], orphanedKeys: [] }
  }

  const allMissingKeys: MissingKeysReport[] = []
  const allOrphanedKeys: OrphanedKeysReport[] = []

  for (const namespace of namespaces) {
    // Use English as the single source of truth
    const sourceData = resources.en?.[namespace] || {}

    for (const targetLang of languages) {
      if (targetLang === 'en')
        continue

      const targetData = resources[targetLang]?.[namespace] || {}

      // Find keys missing in target (present in en, missing in target)
      const missingKeys = findMissingKeys(sourceData, targetData)
      if (missingKeys.length > 0) {
        allMissingKeys.push({
          locale: targetLang,
          namespace,
          keys: missingKeys,
        })
      }

      // Find orphaned keys (present in target, missing in en)
      const orphanedKeys = findMissingKeys(targetData, sourceData)
      if (orphanedKeys.length > 0) {
        allOrphanedKeys.push({
          locale: targetLang,
          namespace,
          keys: orphanedKeys,
        })
      }
    }
  }

  // Print missing keys report
  if (allMissingKeys.length > 0) {
    console.warn(`\n📋 Missing keys (to translate):`)
    for (const report of allMissingKeys) {
      console.warn(`   ${report.locale}/${report.namespace}.locales.${report.locale}.json:`)
      for (const key of report.keys) {
        console.warn(`     - ${key}`)
      }
    }
  }

  // Print orphaned keys report
  if (allOrphanedKeys.length > 0) {
    console.warn(`\n🗑️  Orphaned keys (to remove):`)
    for (const report of allOrphanedKeys) {
      console.warn(`   ${report.locale}/${report.namespace}.locales.${report.locale}.json:`)
      for (const key of report.keys) {
        console.warn(`     - ${key}`)
      }
    }
  }

  if (allMissingKeys.length === 0 && allOrphanedKeys.length === 0) {
    console.warn(`   ✅ All translations are complete and clean`)
  }

  // Generate TypeScript types for i18next
  generateI18nextTypes(localesDir, namespaces)

  return { missingKeys: allMissingKeys, orphanedKeys: allOrphanedKeys }
}

async function checkTranslations() {
  const workspaceRoot = path.resolve(getDirname(import.meta.url), '../../..')

  console.warn('🔍 Searching for locales directories in the monorepo...')

  // Find all locales directories in the monorepo
  const localesPatterns = [
    '**/locales',
    '**/i18n/locales',
    '**/lib/i18n/locales',
  ]

  const foundLocalesDirs: string[] = []

  for (const pattern of localesPatterns) {
    const matches = await glob(pattern, {
      cwd: workspaceRoot,
      absolute: true,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    })
    // Filter to only include directories
    const dirMatches = matches.filter(match => fs.statSync(match).isDirectory())
    foundLocalesDirs.push(...dirMatches)
  }

  // Remove duplicates and sort
  const uniqueLocalesDirs = [...new Set(foundLocalesDirs)].sort()

  if (uniqueLocalesDirs.length === 0) {
    console.warn('❌ No locales directories found in the monorepo')
    return
  }

  console.warn(`📁 Found ${uniqueLocalesDirs.length} locales directory(ies):`)
  uniqueLocalesDirs.forEach((dir) => {
    console.warn(`   📂 ${path.relative(workspaceRoot, dir)}`)
  })

  // Check each locales directory independently
  const allMissingReports: MissingKeysReport[] = []
  const allOrphanedReports: OrphanedKeysReport[] = []

  for (const localesDir of uniqueLocalesDirs) {
    try {
      const { missingKeys, orphanedKeys } = await checkTranslationsForDirectory(localesDir)
      allMissingReports.push(...missingKeys)
      allOrphanedReports.push(...orphanedKeys)
    }
    catch (error) {
      console.error(`❌ Failed to check ${localesDir}:`, error)
    }
  }

  // Print summary
  console.warn(`\n${'─'.repeat(50)}`)

  const hasIssues = allMissingReports.length > 0 || allOrphanedReports.length > 0

  if (!hasIssues) {
    console.warn('✅ All translations are complete and clean!')
  }
  else {
    // Summary for missing keys
    if (allMissingReports.length > 0) {
      const missingByLocale = new Map<string, number>()
      for (const report of allMissingReports) {
        const current = missingByLocale.get(report.locale) || 0
        missingByLocale.set(report.locale, current + report.keys.length)
      }

      const totalMissing = allMissingReports.reduce((sum, r) => sum + r.keys.length, 0)
      const missingSummary = Array.from(missingByLocale.entries())
        .map(([locale, count]) => `${count} in ${locale}`)
        .join(', ')

      console.warn(`⚠️  Missing translations: ${totalMissing} keys (${missingSummary})`)
    }

    // Summary for orphaned keys
    if (allOrphanedReports.length > 0) {
      const orphanedByLocale = new Map<string, number>()
      for (const report of allOrphanedReports) {
        const current = orphanedByLocale.get(report.locale) || 0
        orphanedByLocale.set(report.locale, current + report.keys.length)
      }

      const totalOrphaned = allOrphanedReports.reduce((sum, r) => sum + r.keys.length, 0)
      const orphanedSummary = Array.from(orphanedByLocale.entries())
        .map(([locale, count]) => `${count} in ${locale}`)
        .join(', ')

      console.warn(`🗑️  Orphaned keys: ${totalOrphaned} keys (${orphanedSummary})`)
    }
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  checkTranslations().catch((err) => {
    console.error('❌ Check failed:', err)
    process.exit(1)
  })
}
