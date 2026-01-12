/* eslint-disable node/prefer-global/process */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { glob } from 'glob'

interface TranslationObject {
  [key: string]: string | TranslationObject | string[]
}

function mergeKeys(
  base: TranslationObject,
  target: TranslationObject,
): TranslationObject {
  const result: TranslationObject = { ...target }
  for (const key of Object.keys(base)) {
    const baseVal = base[key]
    const targetVal = target[key]
    if (!(key in target)) {
      if (Array.isArray(baseVal)) {
        result[key] = baseVal
      }
      else if (typeof baseVal === 'object' && baseVal !== null) {
        result[key] = mergeKeys(baseVal as TranslationObject, {})
      }
      else {
        result[key] = `${(baseVal as string)}`
      }
    }
    else if (Array.isArray(baseVal) && Array.isArray(targetVal)) {
      // If both are arrays, preserve the target array (do not overwrite existing translations)
      result[key] = targetVal
    }
    else if (Array.isArray(baseVal) && !Array.isArray(targetVal)) {
      // If base is array but target is not, replace with base array
      result[key] = baseVal
    }
    else if (typeof baseVal === 'object' && baseVal !== null && typeof targetVal === 'object' && targetVal !== null && !Array.isArray(baseVal) && !Array.isArray(targetVal)) {
      result[key] = mergeKeys(baseVal as TranslationObject, targetVal as TranslationObject)
    }
    else if (typeof baseVal === 'object' && baseVal !== null && typeof targetVal === 'string' && !Array.isArray(baseVal)) {
      // If base value is an object but target value is a string, replace with the object structure
      result[key] = mergeKeys(baseVal as TranslationObject, {})
    }
  }
  return result
}

function getDirname(metaUrl: string) {
  return path.dirname(fileURLToPath(metaUrl))
}

function writeLocaleFile(localesDir: string, locale: string, namespace: string, data: TranslationObject) {
  const filePath = path.join(localesDir, locale, `${namespace}.locales.${locale}.json`)
  const content = JSON.stringify(data, null, 2)
  // Add newline at the end to satisfy linter requirements
  const contentWithNewline = `${content}\n`
  fs.writeFileSync(filePath, contentWithNewline, 'utf-8')
}

async function loadLocalesForDirectory(localesDir: string) {
  const enDir = path.join(localesDir, 'en')
  const frDir = path.join(localesDir, 'fr')
  const esDir = path.join(localesDir, 'es')

  const en: Record<string, Record<string, unknown>> = {}
  const fr: Record<string, Record<string, unknown>> = {}
  const es: Record<string, Record<string, unknown>> = {}

  // Load English locales
  if (fs.existsSync(enDir)) {
    const enFiles = fs.readdirSync(enDir).filter(file => file.endsWith('.locales.en.json'))
    for (const file of enFiles) {
      const namespace = file.replace('.locales.en.json', '')
      const filePath = path.join(enDir, file)
      const content = fs.readFileSync(filePath, 'utf-8')
      en[namespace] = JSON.parse(content)
    }
  }

  // Load French locales
  if (fs.existsSync(frDir)) {
    const frFiles = fs.readdirSync(frDir).filter(file => file.endsWith('.locales.fr.json'))
    for (const file of frFiles) {
      const namespace = file.replace('.locales.fr.json', '')
      const filePath = path.join(frDir, file)
      const content = fs.readFileSync(filePath, 'utf-8')
      fr[namespace] = JSON.parse(content)
    }
  }

  // Load Spanish locales
  if (fs.existsSync(esDir)) {
    const esFiles = fs.readdirSync(esDir).filter(file => file.endsWith('.locales.es.json'))
    for (const file of esFiles) {
      const namespace = file.replace('.locales.es.json', '')
      const filePath = path.join(esDir, file)
      const content = fs.readFileSync(filePath, 'utf-8')
      es[namespace] = JSON.parse(content)
    }
  }

  return { en, fr, es }
}

async function syncTranslationsForDirectory(localesDir: string) {
  console.warn(`\n🔄 Syncing translations for: ${localesDir}`)

  const { en, fr, es } = await loadLocalesForDirectory(localesDir)
  const resources = { en, fr, es } as Record<string, Record<string, TranslationObject>>

  const languages = Object.keys(resources)

  // Get all unique namespaces from both languages
  const allNamespaces = new Set<string>()
  for (const lang of languages) {
    const langNamespaces = Object.keys(resources[lang] || {})
    langNamespaces.forEach(namespace => allNamespaces.add(namespace))
  }

  const namespaces = Array.from(allNamespaces).sort()

  if (namespaces.length === 0) {
    console.warn(`   ⚠️  No namespaces found in ${localesDir}`)
    return
  }

  for (const namespace of namespaces) {
    // Use English as the single source of truth
    const sourceData = resources.en?.[namespace] || {}

    for (const targetLang of languages) {
      if (targetLang === 'en')
        continue

      const targetData = resources[targetLang]?.[namespace] || {}
      const merged = mergeKeys(sourceData, targetData)

      // Ensure the target language directory exists
      const targetDir = path.join(localesDir, targetLang)
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
      }

      writeLocaleFile(localesDir, targetLang, namespace, merged)
      console.warn(`   ✅ Synced ${targetLang}/${namespace}.locales.${targetLang}.json (from en)`)
    }
  }
}

async function syncTranslations() {
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

  // Sync each locales directory independently
  for (const localesDir of uniqueLocalesDirs) {
    try {
      await syncTranslationsForDirectory(localesDir)
    }
    catch (error) {
      console.error(`❌ Failed to sync ${localesDir}:`, error)
    }
  }

  console.warn('\n🎉 Translation synchronization completed!')
}

const isMain = import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  syncTranslations().catch((err) => {
    console.error('❌ Sync failed:', err)
    process.exit(1)
  })
}
