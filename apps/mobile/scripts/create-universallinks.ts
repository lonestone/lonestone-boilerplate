import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import Enquirer from 'enquirer'

interface InputPromptOptions {
  message: string
  initial?: string
}

interface ConfirmPromptOptions {
  message: string
  initial?: boolean
}

interface InputPrompt {
  run: () => Promise<string>
}

interface ConfirmPrompt {
  run: () => Promise<boolean>
}

interface EnquirerConstructors {
  Input: new (options: InputPromptOptions) => InputPrompt
  Confirm: new (options: ConfirmPromptOptions) => ConfirmPrompt
}

const { Input, Confirm } = Enquirer as unknown as EnquirerConstructors

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..', '..', '..')

const COLORS = {
  reset: '\x1B[0m',
  green: '\x1B[32m',
  yellow: '\x1B[33m',
  cyan: '\x1B[36m',
} as const

function colorize(text: string, color: keyof typeof COLORS): string {
  return `${COLORS[color]}${text}${COLORS.reset}`
}

async function prompt(message: string, initial: string): Promise<string> {
  const input = new Input({ message, initial })
  return input.run()
}

async function confirm(message: string, initial: boolean = true): Promise<boolean> {
  const question = new Confirm({ message, initial })
  return question.run()
}

function ensureLeadingSlash(value: string): string {
  if (!value) {
    return '/'
  }
  return value.startsWith('/') ? value : `/${value}`
}

function normalizePathList(raw: string): string[] {
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map((s) => {
      const prefixed = ensureLeadingSlash(s)
      return prefixed.endsWith('*') ? prefixed : `${prefixed}${prefixed.endsWith('/') ? '*' : '/*'}`
    })
}

function readAppConfigDefaults(): { iosBundleId?: string, androidPackage?: string, scheme?: string } {
  const appConfigPath = join(projectRoot, 'apps/mobile/app.config.ts')
  try {
    const content = readFileSync(appConfigPath, 'utf-8')
    const iosMatch = content.match(/bundleIdentifier:\s*'([^']+)'/)
    const androidMatch = content.match(/package:\s*'([^']+)'/)
    const schemeMatch = content.match(/scheme:\s*['"]([^'"]+)['"]/)
    return {
      iosBundleId: iosMatch?.[1],
      androidPackage: androidMatch?.[1],
      scheme: schemeMatch?.[1],
    }
  }
  catch {
    return {}
  }
}

function writeJsonFile(path: string, data: unknown): void {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf-8')
  console.log(`  ${colorize('✓', 'green')} wrote ${path}`)
}

function generateFiles(options: {
  domain: string
  paths: string[]
  teamId: string
  iosBundleId: string
  androidPackage: string
  sha256Fingerprints: string[]
}): void {
  const targetDir = join(projectRoot, 'universal-link/.well-known')
  mkdirSync(targetDir, { recursive: true })

  const apple = {
    applinks: {
      apps: [],
      details: [
        {
          appID: `${options.teamId}.${options.iosBundleId}`,
          paths: options.paths,
        },
      ],
    },
  }

  const assetlinks = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: options.androidPackage,
        sha256_cert_fingerprints: options.sha256Fingerprints,
      },
    },
  ]

  writeJsonFile(join(targetDir, 'apple-app-site-association'), apple)
  writeJsonFile(join(targetDir, 'assetlinks.json'), assetlinks)

  const readmePath = join(projectRoot, 'universal-link/README.md')
  const readme = [
    '# Universal Links',
    '',
    `Domaine: https://${options.domain}`,
    `Chemins: ${options.paths.join(', ')}`,
    `iOS appID: ${options.teamId}.${options.iosBundleId}`,
    `Android package: ${options.androidPackage}`,
    '',
    'Fichiers exposés sous `/.well-known/`.',
    '',
    'Tests:',
    `- iOS: https://search.developer.apple.com/appsearch-validation-tool/`,
    `- Android: https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://${options.domain}&relation=delegate_permission/common.handle_all_urls`,
    '',
  ].join('\n')
  writeFileSync(readmePath, `${readme}\n`, 'utf-8')
  console.log(`  ${colorize('✓', 'green')} wrote ${readmePath}`)
}

function updateAppConfig(domain: string, paths: string[]): void {
  const appConfigPath = join(projectRoot, 'apps/mobile/app.config.ts')
  let content: string
  try {
    content = readFileSync(appConfigPath, 'utf-8')
  }
  catch {
    console.log(`  ${colorize('⚠', 'yellow')} Unable to read apps/mobile/app.config.ts, skipping config update`)
    return
  }

  let updated = false

  if (!content.includes('associatedDomains')) {
    const bundleLine = content.match(/(bundleIdentifier:\s*'[^']*',?)/)
    if (bundleLine) {
      const indent = bundleLine[1].match(/^(\s*)/)?.[1] ?? '    '
      const insert = `${bundleLine[1]}\n${indent}associatedDomains: ['applinks:${domain}'],`
      content = content.replace(bundleLine[1], insert)
      updated = true
    }
  }

  if (!content.includes('intentFilters')) {
    const packageLine = content.match(/(package:\s*'[^']*',?)/)
    if (packageLine) {
      const indent = packageLine[1].match(/^(\s*)/)?.[1] ?? '    '
      const dataEntries = paths.map(p => `{ scheme: 'https', host: '${domain}', pathPrefix: '${p}' }`).join(`,\n${indent}    `)
      const intentBlock = [
        packageLine[1],
        `${indent}intentFilters: [{`,
        `${indent}  action: 'VIEW',`,
        `${indent}  data: [`,
        `${indent}    ${dataEntries}`,
        `${indent}  ],`,
        `${indent}  category: ['BROWSABLE', 'DEFAULT'],`,
        `${indent}}],`,
      ].join('\n')
      content = content.replace(packageLine[1], intentBlock)
      updated = true
    }
  }

  if (updated) {
    writeFileSync(appConfigPath, content, 'utf-8')
    console.log(`  ${colorize('✓', 'green')} Updated apps/mobile/app.config.ts (associatedDomains / intentFilters)`)
  }
  else {
    console.log(`  ${colorize('⚠', 'yellow')} app.config.ts not updated (patterns not found or already present)`)
  }
}

async function main(): Promise<void> {
  console.log(`\n${colorize('🌐 Universal Links generator', 'cyan')}\n`)

  const defaults = readAppConfigDefaults()

  const domain = await prompt('Domain (e.g. app.example.com)', 'app.example.com')
  const paths = normalizePathList(await prompt('Path prefixes for deep links (comma separated, e.g. /poi,/reset-password)', '/'))
  const teamId = await prompt('Apple Team ID', 'YOUR_TEAM_ID')
  const iosBundleId = await prompt('iOS Bundle ID', defaults.iosBundleId ?? 'com.example.app')
  const androidPackage = await prompt('Android package name', defaults.androidPackage ?? 'com.example.app')
  const fingerprintsRaw = await prompt('Android SHA-256 fingerprints (comma separated)', 'AA:BB:CC:...')
  const sha256Fingerprints = fingerprintsRaw.split(',').map(s => s.trim()).filter(Boolean)

  generateFiles({ domain, paths, teamId, iosBundleId, androidPackage, sha256Fingerprints })

  const shouldUpdateAppConfig = await confirm('Update apps/mobile/app.config.ts (associatedDomains/intentFilters)?', true)
  if (shouldUpdateAppConfig) {
    updateAppConfig(domain, paths)
  }

  console.log(`\n${colorize('Done.', 'green')} Expose the .well-known files at https://${domain}/.well-known/ and rebuild the app.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
