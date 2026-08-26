/* oxlint-disable node/prefer-global/process */
import type { SupportedLocale } from './i18n-config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { SUPPORTED_LOCALE_KEYS } from './i18n-config'

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
export function findMissingKeys(
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
      missingKeys.push(fullKey)
    } else if (
      typeof baseVal === 'object' &&
      baseVal !== null &&
      !Array.isArray(baseVal) &&
      typeof targetVal === 'object' &&
      targetVal !== null &&
      !Array.isArray(targetVal)
    ) {
      missingKeys.push(
        ...findMissingKeys(baseVal as TranslationObject, targetVal as TranslationObject, fullKey),
      )
    } else if (
      typeof baseVal === 'object' &&
      baseVal !== null &&
      !Array.isArray(baseVal) &&
      typeof targetVal === 'string'
    ) {
      missingKeys.push(fullKey)
    }
  }

  return missingKeys
}

type LocalesData = Record<SupportedLocale, Record<string, Record<string, unknown>>>

function loadLocalesForLocale(
  localesDir: string,
  locale: SupportedLocale,
): Record<string, Record<string, unknown>> {
  const localeDir = path.join(localesDir, locale)
  const result: Record<string, Record<string, unknown>> = {}

  if (!fs.existsSync(localeDir)) {
    return result
  }

  const files = fs.readdirSync(localeDir).filter((file) => file.endsWith(`.locales.${locale}.json`))
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
  const i18nDir = path.dirname(localesDir)
  const typesFilePath = path.join(i18nDir, 'i18next.d.ts')

  if (namespaces.length === 0) {
    console.warn(`   ⚠️  No namespaces to generate types for`)
    return
  }

  const imports = namespaces
    .map((ns) => `import type ${ns}En from './locales/en/${ns}.locales.en.json'`)
    .join('\n')

  const resourceEntries = namespaces.map((ns) => `      ${ns}: typeof ${ns}En`).join('\n')

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

async function checkTranslationsForDirectory(localesDir: string): Promise<CheckResult> {
  console.warn(`\n🔍 Checking translations for: ${localesDir}`)

  const resources = loadLocalesForDirectory(localesDir) as Record<
    string,
    Record<string, TranslationObject>
  >

  const languages = Object.keys(resources)

  const allNamespaces = new Set<string>()
  for (const lang of languages) {
    const langNamespaces = Object.keys(resources[lang] || {})
    langNamespaces.forEach((namespace) => allNamespaces.add(namespace))
  }

  const namespaces = Array.from(allNamespaces).sort()

  if (namespaces.length === 0) {
    console.warn(`   ⚠️  No namespaces found in ${localesDir}`)
    return { missingKeys: [], orphanedKeys: [] }
  }

  const allMissingKeys: MissingKeysReport[] = []
  const allOrphanedKeys: OrphanedKeysReport[] = []

  for (const namespace of namespaces) {
    const sourceData = resources.en?.[namespace] || {}

    for (const targetLang of languages) {
      if (targetLang === 'en') continue

      const targetData = resources[targetLang]?.[namespace] || {}

      const missingKeys = findMissingKeys(sourceData, targetData)
      if (missingKeys.length > 0) {
        allMissingKeys.push({
          locale: targetLang,
          namespace,
          keys: missingKeys,
        })
      }

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

  if (allMissingKeys.length > 0) {
    console.warn(`\n📋 Missing keys (to translate):`)
    for (const report of allMissingKeys) {
      console.warn(`   ${report.locale}/${report.namespace}.locales.${report.locale}.json:`)
      for (const key of report.keys) {
        console.warn(`     - ${key}`)
      }
    }
  }

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

  generateI18nextTypes(localesDir, namespaces)

  return { missingKeys: allMissingKeys, orphanedKeys: allOrphanedKeys }
}

function collectLocalesDirectories(rootDir: string): string[] {
  const found = new Set<string>()
  const ignoredDirNames = new Set([
    'node_modules',
    'dist',
    'build',
    '.git',
    '.turbo',
    'coverage',
    '.worktrees',
  ])

  function walk(currentDir: string) {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }

      if (ignoredDirNames.has(entry.name)) {
        continue
      }

      const fullPath = path.join(currentDir, entry.name)
      if (entry.name === 'locales') {
        found.add(fullPath)
      }

      walk(fullPath)
    }
  }

  walk(rootDir)
  return [...found].sort()
}

async function checkTranslations() {
  const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

  console.warn('🔍 Searching for locales directories in the monorepo...')

  const uniqueLocalesDirs = collectLocalesDirectories(workspaceRoot)

  if (uniqueLocalesDirs.length === 0) {
    console.warn('❌ No locales directories found in the monorepo')
    process.exit(1)
  }

  console.warn(`📁 Found ${uniqueLocalesDirs.length} locales directory(ies):`)
  uniqueLocalesDirs.forEach((dir) => {
    console.warn(`   📂 ${path.relative(workspaceRoot, dir)}`)
  })

  const allMissingReports: MissingKeysReport[] = []
  const allOrphanedReports: OrphanedKeysReport[] = []

  for (const localesDir of uniqueLocalesDirs) {
    try {
      const { missingKeys, orphanedKeys } = await checkTranslationsForDirectory(localesDir)
      allMissingReports.push(...missingKeys)
      allOrphanedReports.push(...orphanedKeys)
    } catch (error) {
      console.error(`❌ Failed to check ${localesDir}:`, error)
      process.exit(1)
    }
  }

  console.warn(`\n${'─'.repeat(50)}`)

  const hasIssues = allMissingReports.length > 0 || allOrphanedReports.length > 0

  if (!hasIssues) {
    console.warn('✅ All translations are complete and clean!')
    return
  }

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

  process.exit(1)
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : ''
const isMain = entryPath !== '' && import.meta.url === pathToFileURL(entryPath).href
if (isMain) {
  checkTranslations().catch((err) => {
    console.error('❌ Check failed:', err)
    process.exit(1)
  })
}
