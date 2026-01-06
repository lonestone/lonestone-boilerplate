import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { colorize } from './utils.js'

export interface MobileConfig {
  appName: string
  slug: string
  scheme: string
  iosBundleId: string
  androidPackage: string
}

export function generateMobileDefaults(projectName: string) {
  const slugify = (value: string, fallback: string): string => {
    const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    return slug || fallback
  }

  const dotNotation = (value: string, fallback: string): string => {
    const dotted = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/\.{2,}/g, '.').replace(/^\.+|\.+$/g, '')
    return dotted || fallback
  }

  const safeScheme = (value: string, fallback: string): string => {
    const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
    return cleaned || fallback
  }

  const slug = slugify(projectName, 'app')
  const appName = `${projectName} Mobile`
  const scheme = safeScheme(projectName, 'app')
  const idBase = dotNotation(projectName, 'app')
  const iosBundleId = `com.${idBase}.mobile`
  const androidPackage = `com.${idBase}.mobile`

  return {
    appName,
    slug,
    scheme,
    iosBundleId,
    androidPackage,
  }
}

export function updateMobileFiles(mobileConfig: MobileConfig, projectRoot: string): void {
  console.log(`\n${colorize('📱 Updating mobile files', 'cyan')}\n`)

  // 1. Update app.config.ts
  const appConfigPath = join(projectRoot, 'apps/mobile/app.config.ts')

  if (existsSync(appConfigPath)) {
    let content = readFileSync(appConfigPath, 'utf-8')
    let updated = false

    const appConfigReplacements: Array<{ pattern: RegExp, value: string, label: string }> = [
      { pattern: /name: '([^']*)',/, value: `name: '${mobileConfig.appName}',`, label: 'app name' },
      { pattern: /slug: '([^']*)',/, value: `slug: '${mobileConfig.slug}',`, label: 'slug' },
      { pattern: /bundleIdentifier: '([^']*)',/, value: `bundleIdentifier: '${mobileConfig.iosBundleId}',`, label: 'iOS bundle identifier' },
      { pattern: /package: '([^']*)',/, value: `package: '${mobileConfig.androidPackage}',`, label: 'Android package name' },
    ]

    for (const { pattern, value, label } of appConfigReplacements) {
      const nextContent = content.replace(pattern, value)
      if (nextContent !== content) {
        content = nextContent
        updated = true
      }
      else {
        console.log(`  ${colorize('⚠', 'yellow')} Could not update mobile ${colorize(label, 'dim')} automatically (pattern not found)`)
      }
    }

    if (updated) {
      writeFileSync(appConfigPath, content, 'utf-8')
      console.log(`  ${colorize('✓', 'green')} Updated ${colorize('apps/mobile/app.config.ts', 'dim')}`)
    }
  }
  else {
    console.log(`  ${colorize('⚠', 'yellow')} File not found: ${colorize('apps/mobile/app.config.ts', 'dim')}`)
  }

  // 2. Update TypeScript files with scheme
  const tsFilesToUpdate = [
    {
      path: join(projectRoot, 'apps/mobile/lib/auth-client.ts'),
      replacements: [
        { pattern: /scheme:\s*'[^']*',/, value: `scheme: '${mobileConfig.scheme}',`, label: 'auth-client.ts scheme' },
      ],
    },
    {
      path: join(projectRoot, 'apps/mobile/lib/api-client.ts'),
      replacements: [
        { pattern: /const mobileScheme = Constants\.expoConfig\?\.scheme \?\? '[^']*'/, value: `const mobileScheme = Constants.expoConfig?.scheme ?? '${mobileConfig.scheme}'`, label: 'api-client.ts scheme fallback' },
      ],
    },
    {
      path: join(projectRoot, 'apps/mobile/lib/secure-storage-adapter.ts'),
      replacements: [
        { pattern: /export const AUTH_STORAGE_PREFIX = '[^']*'/, value: `export const AUTH_STORAGE_PREFIX = '${mobileConfig.scheme}_auth'`, label: 'secure-storage-adapter.ts prefix' },
      ],
    },
  ]

  for (const { path, replacements } of tsFilesToUpdate) {
    if (!existsSync(path)) {
      console.log(`  ${colorize('⚠', 'yellow')} File not found: ${colorize(path, 'dim')}`)
      continue
    }

    let content = readFileSync(path, 'utf-8')
    let updated = false

    for (const { pattern, value, label } of replacements) {
      const nextContent = content.replace(pattern, value)
      if (nextContent !== content) {
        content = nextContent
        updated = true
      }
      else {
        console.log(`  ${colorize('⚠', 'yellow')} Could not update ${colorize(label, 'dim')} (pattern not found)`)
      }
    }

    if (updated) {
      writeFileSync(path, content, 'utf-8')
      const fileName = path.replace(projectRoot, '')
      console.log(`  ${colorize('✓', 'green')} Updated ${colorize(fileName, 'dim')}`)
    }
  }
}
