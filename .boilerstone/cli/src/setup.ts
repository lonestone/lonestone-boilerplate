import { spawn } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import Enquirer from 'enquirer'
import { CLI_PACKAGE_NAME } from './boilerplate-core.js'
import { hasTemplateScope, isBoilerplateMaintainerCheckout } from './generate.js'
import { colorize } from './utils.js'

interface InputPromptOptions {
  message: string
  initial?: string
}

interface ConfirmPromptOptions {
  name: string
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
const projectRoot = process.cwd()

interface AvailableApps {
  api: boolean
  webSpa: boolean
  webSsr: boolean
  openapiGenerator: boolean
}

interface EnvConfig {
  database: {
    user: string
    password: string
    name: string
    host: string
    port: number
  }
  ports: {
    api?: number
    webSpa?: number
    webSsr?: number
  }
  smtp: {
    port: number
    portWeb: number
  }
}

async function prompt(message: string, initial: string): Promise<string> {
  const input = new Input({
    message,
    initial,
  })
  return input.run()
}

async function confirm(message: string): Promise<boolean> {
  const confirmPrompt = new Confirm({
    name: 'confirm',
    message,
    initial: false,
  })
  return confirmPrompt.run()
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(
      `\n  ${colorize('→', 'cyan')} Running: ${colorize(`${command} ${args.join(' ')}`, 'dim')}\n`,
    )

    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: true,
      windowsHide: true,
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Command failed with exit code ${code}`))
      }
    })

    child.on('error', (error) => {
      reject(error)
    })
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForDatabase(maxRetries: number = 30, delayMs: number = 1000): Promise<boolean> {
  console.log(`  ${colorize('⏳', 'yellow')} Waiting for database to be ready...`)

  for (let i = 0; i < maxRetries; i++) {
    try {
      const child = spawn(
        'docker',
        ['compose', 'exec', '-T', 'db', 'pg_isready', '-U', 'postgres'],
        {
          cwd: projectRoot,
          stdio: 'pipe',
          shell: true,
          windowsHide: true,
        },
      )

      const exitCode = await new Promise<number>((resolve) => {
        child.on('close', (code) => resolve(code ?? 1))
        child.on('error', () => resolve(1))
      })

      if (exitCode === 0) {
        console.log(`  ${colorize('✓', 'green')} Database is ready!`)
        return true
      }
    } catch {
      // Ignore errors, retry
    }

    await sleep(delayMs)
    process.stdout.write(`  ${colorize('⏳', 'yellow')} Waiting... (${i + 1}/${maxRetries})\r`)
  }

  console.log(`\n  ${colorize('⚠', 'yellow')} Database not ready after ${maxRetries} attempts`)
  return false
}

function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    return {}
  }

  const content = readFileSync(filePath, 'utf-8')
  const vars: Record<string, string> = {}

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([^=]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        const value = match[2].trim()
        vars[key] = value
      }
    }
  }

  return vars
}

function getViteConfigPort(filePath: string): number | undefined {
  if (!existsSync(filePath)) {
    return undefined
  }

  const content = readFileSync(filePath, 'utf-8')
  const match = content.match(/server\s*:\s*\{[\s\S]*?\bport\s*:\s*(\d+)/)
  if (!match) {
    return undefined
  }
  return Number.parseInt(match[1], 10)
}

function updateViteConfigPort(filePath: string, port: number): void {
  if (!existsSync(filePath)) {
    console.log(`  ${colorize('⚠', 'yellow')} File not found: ${colorize(filePath, 'dim')}`)
    return
  }

  const content = readFileSync(filePath, 'utf-8')
  const regex = /(server\s*:\s*\{[\s\S]*?\bport\s*:\s*)(\d+)/
  if (!regex.test(content)) {
    console.log(
      `  ${colorize('⚠', 'yellow')} Could not find Vite server port in: ${colorize(filePath, 'dim')}`,
    )
    return
  }

  const updated = content.replace(regex, `$1${port}`)
  if (updated !== content) {
    writeFileSync(filePath, updated, 'utf-8')
    console.log(
      `  ${colorize('✓', 'green')} Updated ${colorize(filePath.replace(`${projectRoot}/`, ''), 'dim')}`,
    )
  }
}

function getMissingVariables(examplePath: string, envPath: string): string[] {
  const exampleVars = parseEnvFile(examplePath)
  const envVars = parseEnvFile(envPath)

  return Object.keys(exampleVars).filter((key) => !(key in envVars) || !envVars[key])
}

function detectAvailableApps(): AvailableApps {
  const appsDir = join(projectRoot, 'apps')
  const packagesDir = join(projectRoot, 'packages')

  const apps: AvailableApps = {
    api: false,
    webSpa: false,
    webSsr: false,
    openapiGenerator: false,
  }

  if (existsSync(appsDir)) {
    const appDirs = readdirSync(appsDir).filter((item) => {
      const itemPath = join(appsDir, item)
      return statSync(itemPath).isDirectory()
    })

    apps.api = appDirs.includes('api')
    apps.webSpa = appDirs.includes('web-spa')
    apps.webSsr = appDirs.includes('web-ssr')
  }

  if (existsSync(packagesDir)) {
    const packageDirs = readdirSync(packagesDir).filter((item) => {
      const itemPath = join(packagesDir, item)
      return statSync(itemPath).isDirectory()
    })

    apps.openapiGenerator = packageDirs.includes('openapi-generator')
  }

  return apps
}

async function promptDatabaseConfig(): Promise<EnvConfig['database']> {
  const rootEnvPath = join(projectRoot, '.env')
  const rootExamplePath = join(projectRoot, '.env.example')
  const envExists = existsSync(rootEnvPath)
  const existingVars = envExists ? parseEnvFile(rootEnvPath) : {}
  const exampleVars = parseEnvFile(rootExamplePath)
  const missingVars = envExists
    ? getMissingVariables(rootExamplePath, rootEnvPath)
    : Object.keys(exampleVars)

  const dbVars = [
    'DATABASE_USER',
    'DATABASE_PASSWORD',
    'DATABASE_NAME',
    'DATABASE_HOST',
    'DATABASE_PORT',
  ]
  const needsDbConfig = dbVars.some((v) => missingVars.includes(v))

  if (!needsDbConfig) {
    console.log(`\n${colorize('📊 Database Configuration', 'cyan')}`)
    console.log(`  ${colorize('✓', 'green')} Database variables already configured`)
    return {
      user: existingVars.DATABASE_USER || 'postgres',
      password: existingVars.DATABASE_PASSWORD || 'postgres',
      name: existingVars.DATABASE_NAME || 'lonestone_test',
      host: existingVars.DATABASE_HOST || 'localhost',
      port: Number.parseInt(existingVars.DATABASE_PORT || '5111', 10),
    }
  }

  console.log(`\n${colorize('📊 Database Configuration', 'cyan')}\n`)

  const user = missingVars.includes('DATABASE_USER')
    ? await prompt(
        'Database user',
        existingVars.DATABASE_USER || exampleVars.DATABASE_USER || 'postgres',
      )
    : existingVars.DATABASE_USER || 'postgres'

  const password = missingVars.includes('DATABASE_PASSWORD')
    ? await prompt(
        'Database password',
        existingVars.DATABASE_PASSWORD || exampleVars.DATABASE_PASSWORD || 'postgres',
      )
    : existingVars.DATABASE_PASSWORD || 'postgres'

  const name = missingVars.includes('DATABASE_NAME')
    ? await prompt(
        'Database name',
        existingVars.DATABASE_NAME || exampleVars.DATABASE_NAME || 'lonestone_test',
      )
    : existingVars.DATABASE_NAME || 'lonestone_test'

  const host = missingVars.includes('DATABASE_HOST')
    ? await prompt(
        'Database host',
        existingVars.DATABASE_HOST || exampleVars.DATABASE_HOST || 'localhost',
      )
    : existingVars.DATABASE_HOST || 'localhost'

  const portStr = missingVars.includes('DATABASE_PORT')
    ? await prompt(
        'Database port',
        existingVars.DATABASE_PORT || exampleVars.DATABASE_PORT || '5111',
      )
    : existingVars.DATABASE_PORT || '5111'
  const port = Number.parseInt(portStr, 10) || 5111

  return { user, password, name, host, port }
}

async function promptPortsConfig(availableApps: AvailableApps): Promise<EnvConfig['ports']> {
  const ports: EnvConfig['ports'] = {}

  console.log(`\n${colorize('🔌 Application Ports Configuration', 'cyan')}\n`)

  if (availableApps.api) {
    const apiExamplePath = join(projectRoot, 'apps/api/.env.example')
    const apiEnvPath = join(projectRoot, 'apps/api/.env')
    const envExists = existsSync(apiEnvPath)
    const existingVars = envExists ? parseEnvFile(apiEnvPath) : {}
    const exampleVars = parseEnvFile(apiExamplePath)
    const initialPort = existingVars.API_PORT || exampleVars.API_PORT || '3000'
    const apiPortStr = await prompt('API port', initialPort)
    ports.api = Number.parseInt(apiPortStr, 10) || 3000
  }

  if (availableApps.webSpa) {
    const viteConfigPath = join(projectRoot, 'apps/web-spa/vite.config.ts')
    const initialPort = (getViteConfigPort(viteConfigPath) ?? 5173).toString()
    const webSpaPortStr = await prompt('Web SPA port', initialPort)
    ports.webSpa = Number.parseInt(webSpaPortStr, 10) || 5173
  }

  if (availableApps.webSsr) {
    const viteConfigPath = join(projectRoot, 'apps/web-ssr/vite.config.ts')
    const initialPort = (getViteConfigPort(viteConfigPath) ?? 5174).toString()
    const webSsrPortStr = await prompt('Web SSR port', initialPort)
    ports.webSsr = Number.parseInt(webSsrPortStr, 10) || 5174
  }

  return ports
}

async function promptSmtpConfig(): Promise<EnvConfig['smtp']> {
  const rootEnvPath = join(projectRoot, '.env')
  const rootExamplePath = join(projectRoot, '.env.example')
  const envExists = existsSync(rootEnvPath)
  const existingVars = envExists ? parseEnvFile(rootEnvPath) : {}
  const exampleVars = parseEnvFile(rootExamplePath)
  const missingVars = envExists
    ? getMissingVariables(rootExamplePath, rootEnvPath)
    : Object.keys(exampleVars)

  const smtpVars = ['SMTP_PORT', 'SMTP_PORT_WEB']
  const needsSmtpConfig = smtpVars.some((v) => missingVars.includes(v))

  if (!needsSmtpConfig) {
    console.log(`\n${colorize('📧 SMTP Configuration (MailDev)', 'cyan')}`)
    console.log(`  ${colorize('✓', 'green')} SMTP variables already configured`)
    return {
      port: Number.parseInt(existingVars.SMTP_PORT || '1025', 10),
      portWeb: Number.parseInt(existingVars.SMTP_PORT_WEB || '1080', 10),
    }
  }

  console.log(`\n${colorize('📧 SMTP Configuration (MailDev)', 'cyan')}\n`)

  const portStr = missingVars.includes('SMTP_PORT')
    ? await prompt('SMTP port', existingVars.SMTP_PORT || exampleVars.SMTP_PORT || '1025')
    : existingVars.SMTP_PORT || '1025'
  const port = Number.parseInt(portStr, 10) || 1025

  const portWebStr = missingVars.includes('SMTP_PORT_WEB')
    ? await prompt(
        'MailDev web port',
        existingVars.SMTP_PORT_WEB || exampleVars.SMTP_PORT_WEB || '1080',
      )
    : existingVars.SMTP_PORT_WEB || '1080'
  const portWeb = Number.parseInt(portWebStr, 10) || 1080

  return { port, portWeb }
}

interface EnvFileInfo {
  from: string
  to: string
  exists: boolean
  missingVars: string[]
}

/**
 * Every `.env.example` at the root and one level under `apps/` and `packages/`,
 * so an app the project added itself gets its `.env` too.
 */
function findEnvExamples(): Array<{ from: string; to: string }> {
  const envFiles: Array<{ from: string; to: string }> = [{ from: '.env.example', to: '.env' }]

  for (const parent of ['apps', 'packages']) {
    const parentPath = join(projectRoot, parent)
    if (!existsSync(parentPath)) {
      continue
    }
    for (const entry of readdirSync(parentPath, { withFileTypes: true })) {
      const from = `${parent}/${entry.name}/.env.example`
      if (entry.isDirectory() && existsSync(join(projectRoot, from))) {
        envFiles.push({ from, to: `${parent}/${entry.name}/.env` })
      }
    }
  }

  return envFiles
}

function checkEnvFiles(): EnvFileInfo[] {
  return findEnvExamples().map(({ from, to }) => {
    const fromPath = join(projectRoot, from)
    const toPath = join(projectRoot, to)
    const exists = existsSync(toPath)
    const missingVars = exists ? getMissingVariables(fromPath, toPath) : []

    return { from, to, exists, missingVars }
  })
}

function copyEnvFiles(envFilesInfo: EnvFileInfo[]): void {
  console.log(`\n${colorize('📋 Checking .env files', 'cyan')}\n`)

  for (const { from, to, exists, missingVars } of envFilesInfo) {
    const fromPath = join(projectRoot, from)
    const toPath = join(projectRoot, to)

    if (exists) {
      if (missingVars.length > 0) {
        console.log(
          `  ${colorize('⚠', 'yellow')} ${colorize(to, 'dim')} exists but missing variables: ${colorize(missingVars.join(', '), 'yellow')}`,
        )
      } else {
        console.log(`  ${colorize('✓', 'green')} ${colorize(to, 'dim')} exists and is complete`)
      }
      continue
    }

    if (existsSync(fromPath)) {
      copyFileSync(fromPath, toPath)
      console.log(
        `  ${colorize('✓', 'green')} Copied ${colorize(from, 'dim')} → ${colorize(to, 'dim')}`,
      )
    } else {
      console.log(`  ${colorize('⚠', 'yellow')} File not found: ${colorize(from, 'dim')}`)
    }
  }
}

function updateEnvFile(
  filePath: string,
  replacements: Record<string, string | ((old: string | null) => string)>,
  onlyMissing: boolean = false,
): void {
  if (!existsSync(filePath)) {
    console.log(`  ${colorize('⚠', 'yellow')} File not found: ${colorize(filePath, 'dim')}`)
    return
  }

  let content = readFileSync(filePath, 'utf-8')
  const existingVars = parseEnvFile(filePath)
  let updated = false

  for (const [key, value] of Object.entries(replacements)) {
    const f = typeof value === 'function' ? value : () => value

    if (onlyMissing && key in existingVars && existingVars[key]) {
      continue
    }

    const regex = new RegExp(`^${key}=(.*)$`, 'm')
    if (regex.test(content)) {
      const old = regex.exec(content)?.[1] ?? null
      content = content.replace(regex, `${key}=${f(old)}`)
      updated = true
    } else {
      content += `\n${key}=${f(null)}`
      updated = true
    }
  }

  if (updated) {
    writeFileSync(filePath, content, 'utf-8')
  }
}

function buildTrustedOrigins(config: EnvConfig, apiEnvPath: string): string {
  const examplePath = apiEnvPath.replace(/\.env$/, '.env.example')
  const existingVars = parseEnvFile(existsSync(apiEnvPath) ? apiEnvPath : examplePath)
  const existingOrigins = (existingVars.TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((o: string) => o.trim())
    .filter(Boolean)

  const localhostFromFile = existingOrigins.filter(
    (origin: string) =>
      origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:'),
  )
  const nonLocalhostOrigins = existingOrigins.filter(
    (origin: string) =>
      !origin.startsWith('http://localhost:') && !origin.startsWith('https://localhost:'),
  )

  const fromConfig: string[] = []
  if (config.ports.api) {
    fromConfig.push(`http://localhost:${config.ports.api}`)
  }
  if (config.ports.webSpa) {
    fromConfig.push(`http://localhost:${config.ports.webSpa}`)
  }
  if (config.ports.webSsr) {
    fromConfig.push(`http://localhost:${config.ports.webSsr}`)
  }

  const localhostMerged = [...new Set([...fromConfig, ...localhostFromFile])]

  return [...localhostMerged, ...nonLocalhostOrigins].join(',')
}

function updateViteConfigPorts(config: EnvConfig, availableApps: AvailableApps): void {
  console.log(`\n${colorize('⚙️  Updating Vite dev server ports', 'cyan')}\n`)

  if (availableApps.webSpa && config.ports.webSpa) {
    updateViteConfigPort(join(projectRoot, 'apps/web-spa/vite.config.ts'), config.ports.webSpa)
  }

  if (availableApps.webSsr && config.ports.webSsr) {
    updateViteConfigPort(join(projectRoot, 'apps/web-ssr/vite.config.ts'), config.ports.webSsr)
  }
}

function updateAllEnvFiles(config: EnvConfig, availableApps: AvailableApps): void {
  console.log(`\n${colorize('✏️  Updating .env files', 'cyan')}\n`)

  // Root .env (docker-compose) - update all configured vars
  const rootUpdates: Record<string, string | ((old: string | null) => string)> = {}
  rootUpdates.DATABASE_USER = config.database.user
  rootUpdates.DATABASE_PASSWORD = config.database.password
  rootUpdates.DATABASE_NAME = config.database.name
  rootUpdates.DATABASE_HOST = config.database.host
  rootUpdates.DATABASE_PORT = config.database.port.toString()
  rootUpdates.SMTP_PORT = config.smtp.port.toString()
  rootUpdates.SMTP_PORT_WEB = config.smtp.portWeb.toString()

  if (config.ports.api) {
    rootUpdates.API_PORT = config.ports.api.toString()
    rootUpdates.API_BASE_URL = `http://localhost:${config.ports.api}`
    const rootEnvPath = join(projectRoot, '.env')
    rootUpdates.TRUSTED_ORIGINS = buildTrustedOrigins(config, rootEnvPath)
  }

  if (Object.keys(rootUpdates).length > 0) {
    updateEnvFile(join(projectRoot, '.env'), rootUpdates, false)
  }

  // API .env
  if (availableApps.api && config.ports.api) {
    const apiEnvPath = join(projectRoot, 'apps/api/.env')
    const trustedOrigins = buildTrustedOrigins(config, apiEnvPath)
    const updates: Record<string, string> = {}

    updates.API_PORT = config.ports.api.toString()
    updates.DATABASE_USER = config.database.user
    updates.DATABASE_PASSWORD = config.database.password
    updates.DATABASE_NAME = config.database.name
    updates.DATABASE_HOST = config.database.host
    updates.DATABASE_PORT = config.database.port.toString()
    updates.TRUSTED_ORIGINS = trustedOrigins

    if (config.ports.webSpa) {
      updates.CLIENTS_WEB_APP_URL = `http://localhost:${config.ports.webSpa}`
    }
    if (config.ports.webSsr) {
      updates.CLIENTS_WEB_SSR_URL = `http://localhost:${config.ports.webSsr}`
    }

    if (Object.keys(updates).length > 0) {
      updateEnvFile(apiEnvPath, updates, false)
    }
  }

  // Web SPA .env
  if (availableApps.webSpa && config.ports.api) {
    const webSpaEnvPath = join(projectRoot, 'apps/web-spa/.env')
    const apiUrl = `http://localhost:${config.ports.api}`
    updateEnvFile(webSpaEnvPath, { VITE_API_URL: apiUrl }, false)
  }

  // Web SSR .env
  if (availableApps.webSsr && config.ports.api) {
    const webSsrEnvPath = join(projectRoot, 'apps/web-ssr/.env')
    const apiUrl = `http://localhost:${config.ports.api}`
    updateEnvFile(webSsrEnvPath, { VITE_API_URL: apiUrl }, false)
  }

  // OpenAPI Generator .env
  if (availableApps.openapiGenerator && config.ports.api) {
    const openapiEnvPath = join(projectRoot, 'packages/openapi-generator/.env')
    // Includes the API global prefix: preprocess fetches `${API_URL}/docs.json`.
    const apiUrl = `http://localhost:${config.ports.api}/api`
    updateEnvFile(openapiEnvPath, { API_URL: apiUrl }, false)
  }

  console.log(`  ${colorize('✓', 'green')} Configuration values have been updated in .env files`)
}

/**
 * A checkout that still uses the template scope was cloned by hand instead of
 * generated by `init`. Rock never renames or strips anything, so say so
 * instead of leaving a half-configured template behind.
 */
async function confirmRawTemplateSetup(): Promise<boolean> {
  if (!hasTemplateScope(projectRoot) || isBoilerplateMaintainerCheckout(projectRoot)) {
    return true
  }
  console.log(
    `  ${colorize('⚠', 'yellow')} This looks like the raw boilerplate template, not a generated project.`,
  )
  console.log(
    `  ${colorize('→', 'cyan')} To start a new project, run: ${colorize(`pnpm dlx ${CLI_PACKAGE_NAME} init my-app`, 'bright')}`,
  )
  return confirm('Set up the local environment of this checkout anyway?')
}

async function main(): Promise<void> {
  console.log(`\n${colorize('🚀 Development Environment Setup', 'bright')}\n`)

  try {
    if (!(await confirmRawTemplateSetup())) {
      return
    }

    // Detect available applications
    const availableApps = detectAvailableApps()

    console.log(`${colorize('📦 Detected Applications:', 'cyan')}`)
    if (availableApps.api) console.log(`  ${colorize('✓', 'green')} ${colorize('API', 'bright')}`)
    if (availableApps.webSpa)
      console.log(`  ${colorize('✓', 'green')} ${colorize('Web SPA', 'bright')}`)
    if (availableApps.webSsr)
      console.log(`  ${colorize('✓', 'green')} ${colorize('Web SSR', 'bright')}`)
    if (availableApps.openapiGenerator)
      console.log(`  ${colorize('✓', 'green')} ${colorize('OpenAPI Generator', 'bright')}`)

    // Check .env files (but don't copy yet)
    const envFilesInfo = checkEnvFiles()

    // Prompt for configuration BEFORE copying files
    const databaseConfig = await promptDatabaseConfig()
    const portsConfig = await promptPortsConfig(availableApps)
    const smtpConfig = await promptSmtpConfig()

    const config: EnvConfig = {
      database: databaseConfig,
      ports: portsConfig,
      smtp: smtpConfig,
    }

    // Now copy .env files (only if they don't exist)
    copyEnvFiles(envFilesInfo)

    // Update .env files with the configured values
    updateAllEnvFiles(config, availableApps)

    // Update Vite config ports (SPA/SSR)
    updateViteConfigPorts(config, availableApps)

    console.log(`\n${colorize('✅ Setup completed successfully!', 'green')}`)
    console.log(`\n${colorize('📝 Configuration Summary:', 'cyan')}`)
    console.log(
      `  ${colorize('Database:', 'bright')} ${colorize(`${config.database.user}@${config.database.host}:${config.database.port}/${config.database.name}`, 'dim')}`,
    )
    if (config.ports.api) {
      console.log(
        `  ${colorize('API:', 'bright')} ${colorize(`http://localhost:${config.ports.api}`, 'blue')}`,
      )
    }
    if (config.ports.webSpa) {
      console.log(
        `  ${colorize('Web SPA:', 'bright')} ${colorize(`http://localhost:${config.ports.webSpa}`, 'blue')}`,
      )
    }
    if (config.ports.webSsr) {
      console.log(
        `  ${colorize('Web SSR:', 'bright')} ${colorize(`http://localhost:${config.ports.webSsr}`, 'blue')}`,
      )
    }
    console.log(
      `  ${colorize('SMTP:', 'bright')} ${colorize(`localhost:${config.smtp.port}`, 'dim')} ${colorize(`(Web: ${config.smtp.portWeb})`, 'dim')}`,
    )

    // Ask to start Docker
    let dockerStarted = false
    console.log(`\n${colorize('🐳 Docker Services', 'cyan')}`)
    const shouldStartDocker = await confirm('Start Docker services (database, maildev)?')

    if (shouldStartDocker) {
      try {
        await runCommand('pnpm', ['docker:up'])
        console.log(`\n  ${colorize('✓', 'green')} Docker services started`)
        dockerStarted = true

        // Wait for database to be ready
        const dbReady = await waitForDatabase()

        if (dbReady && availableApps.api) {
          console.log(`\n${colorize('🗄️  Database Migrations', 'cyan')}`)
          const shouldRunMigrations = await confirm('Run database migrations?')

          if (shouldRunMigrations) {
            try {
              await runCommand('pnpm', ['--filter=api', 'db:migrate:up'])
              console.log(`\n  ${colorize('✓', 'green')} Migrations completed successfully`)
            } catch (error) {
              console.error(`\n  ${colorize('⚠', 'yellow')} Migration failed:`, error)
              console.log(
                `  ${colorize('You can run migrations manually later with:', 'dim')} ${colorize('pnpm --filter=api db:migrate:up', 'bright')}`,
              )
            }
          } else {
            console.log(
              `  ${colorize('→', 'cyan')} Skipped migrations. Run manually with: ${colorize('pnpm --filter=api db:migrate:up', 'bright')}`,
            )
          }
        } else if (!dbReady && availableApps.api) {
          console.log(
            `  ${colorize('→', 'cyan')} Database not ready. Run migrations manually with: ${colorize('pnpm --filter=api db:migrate:up', 'bright')}`,
          )
        }
      } catch (error) {
        console.error(`\n  ${colorize('⚠', 'yellow')} Failed to start Docker:`, error)
        console.log(
          `  ${colorize('You can start Docker manually with:', 'dim')} ${colorize('pnpm docker:up', 'bright')}`,
        )
      }
    } else {
      console.log(
        `  ${colorize('→', 'cyan')} Skipped Docker. Start manually with: ${colorize('pnpm docker:up', 'bright')}`,
      )
      if (availableApps.api) {
        console.log(
          `  ${colorize('→', 'cyan')} Migrations skipped (requires Docker). Run with: ${colorize('pnpm --filter=api db:migrate:up', 'bright')}`,
        )
      }
    }

    // Invite to start dev
    console.log(`\n${colorize('🎉 Setup complete!', 'green')}`)
    console.log(`\n${colorize('Next steps:', 'cyan')}`)

    let step = 1
    if (!dockerStarted) {
      console.log(
        `  ${colorize(`${step}.`, 'bright')} Start Docker services: ${colorize('pnpm docker:up', 'blue')}`,
      )
      step++
      if (availableApps.api) {
        console.log(
          `  ${colorize(`${step}.`, 'bright')} Run migrations: ${colorize('pnpm --filter=api db:migrate:up', 'blue')}`,
        )
        step++
      }
    }
    console.log(
      `  ${colorize(`${step}.`, 'bright')} Start development: ${colorize('pnpm dev', 'blue')}\n`,
    )
  } catch (error) {
    console.error(`\n${colorize('❌ Error during setup:', 'red')}`, error)
    process.exit(1)
  }
}

const isDirectExecution = process.argv[1] ? resolve(process.argv[1]) === __filename : false
if (isDirectExecution) {
  main()
}

export { main as runSetup }
