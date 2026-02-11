import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import Enquirer from 'enquirer'
import { colorize } from './utils'

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
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

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
    console.log(`\n  ${colorize('→', 'cyan')} Running: ${colorize(`${command} ${args.join(' ')}`, 'dim')}\n`)

    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: true,
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      }
      else {
        reject(new Error(`Command failed with exit code ${code}`))
      }
    })

    child.on('error', (error) => {
      reject(error)
    })
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForDatabase(maxRetries: number = 30, delayMs: number = 1000): Promise<boolean> {
  console.log(`  ${colorize('⏳', 'yellow')} Waiting for database to be ready...`)

  for (let i = 0; i < maxRetries; i++) {
    try {
      const child = spawn('docker', ['compose', 'exec', '-T', 'db', 'pg_isready', '-U', 'postgres'], {
        cwd: projectRoot,
        stdio: 'pipe',
        shell: true,
      })

      const exitCode = await new Promise<number>((resolve) => {
        child.on('close', code => resolve(code ?? 1))
        child.on('error', () => resolve(1))
      })

      if (exitCode === 0) {
        console.log(`  ${colorize('✓', 'green')} Database is ready!`)
        return true
      }
    }
    catch {
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

function getMissingVariables(examplePath: string, envPath: string): string[] {
  const exampleVars = parseEnvFile(examplePath)
  const envVars = parseEnvFile(envPath)

  return Object.keys(exampleVars).filter(key => !(key in envVars) || !envVars[key])
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
  const missingVars = envExists ? getMissingVariables(rootExamplePath, rootEnvPath) : Object.keys(exampleVars)

  const dbVars = ['DATABASE_USER', 'DATABASE_PASSWORD', 'DATABASE_NAME', 'DATABASE_HOST', 'DATABASE_PORT']
  const needsDbConfig = dbVars.some(v => missingVars.includes(v))

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
    ? await prompt('Database user', existingVars.DATABASE_USER || exampleVars.DATABASE_USER || 'postgres')
    : existingVars.DATABASE_USER || 'postgres'

  const password = missingVars.includes('DATABASE_PASSWORD')
    ? await prompt('Database password', existingVars.DATABASE_PASSWORD || exampleVars.DATABASE_PASSWORD || 'postgres')
    : existingVars.DATABASE_PASSWORD || 'postgres'

  const name = missingVars.includes('DATABASE_NAME')
    ? await prompt('Database name', existingVars.DATABASE_NAME || exampleVars.DATABASE_NAME || 'lonestone_test')
    : existingVars.DATABASE_NAME || 'lonestone_test'

  const host = missingVars.includes('DATABASE_HOST')
    ? await prompt('Database host', existingVars.DATABASE_HOST || exampleVars.DATABASE_HOST || 'localhost')
    : existingVars.DATABASE_HOST || 'localhost'

  const portStr = missingVars.includes('DATABASE_PORT')
    ? await prompt('Database port', existingVars.DATABASE_PORT || exampleVars.DATABASE_PORT || '5111')
    : existingVars.DATABASE_PORT || '5111'
  const port = Number.parseInt(portStr, 10) || 5111

  return { user, password, name, host, port }
}

async function promptPortsConfig(availableApps: AvailableApps): Promise<EnvConfig['ports']> {
  const ports: EnvConfig['ports'] = {}
  const needsPortConfig: string[] = []

  if (availableApps.api) {
    const apiExamplePath = join(projectRoot, 'apps/api/.env.example')
    const apiEnvPath = join(projectRoot, 'apps/api/.env')
    const envExists = existsSync(apiEnvPath)
    const existingVars = envExists ? parseEnvFile(apiEnvPath) : {}
    const exampleVars = parseEnvFile(apiExamplePath)
    const missingVars = envExists ? getMissingVariables(apiExamplePath, apiEnvPath) : Object.keys(exampleVars)

    if (missingVars.includes('API_PORT')) {
      needsPortConfig.push('API')
    }
    else {
      ports.api = Number.parseInt(existingVars.API_PORT || '3000', 10)
    }
  }

  if (availableApps.webSpa) {
    const webSpaExamplePath = join(projectRoot, 'apps/web-spa/.env.example')
    const webSpaEnvPath = join(projectRoot, 'apps/web-spa/.env')
    const envExists = existsSync(webSpaEnvPath)
    const missingVars = envExists ? getMissingVariables(webSpaExamplePath, webSpaEnvPath) : []

    if (missingVars.length > 0) {
      needsPortConfig.push('Web SPA')
    }
  }

  if (availableApps.webSsr) {
    const webSsrExamplePath = join(projectRoot, 'apps/web-ssr/.env.example')
    const webSsrEnvPath = join(projectRoot, 'apps/web-ssr/.env')
    const envExists = existsSync(webSsrEnvPath)
    const missingVars = envExists ? getMissingVariables(webSsrExamplePath, webSsrEnvPath) : []

    if (missingVars.length > 0) {
      needsPortConfig.push('Web SSR')
    }
  }

  if (needsPortConfig.length === 0) {
    console.log(`\n${colorize('🔌 Application Ports Configuration', 'cyan')}`)
    console.log(`  ${colorize('✓', 'green')} Ports already configured`)
    return ports
  }

  console.log(`\n${colorize('🔌 Application Ports Configuration', 'cyan')}\n`)

  if (availableApps.api && needsPortConfig.includes('API')) {
    const apiExamplePath = join(projectRoot, 'apps/api/.env.example')
    const apiEnvPath = join(projectRoot, 'apps/api/.env')
    const envExists = existsSync(apiEnvPath)
    const existingVars = envExists ? parseEnvFile(apiEnvPath) : {}
    const exampleVars = parseEnvFile(apiExamplePath)
    const initialPort = existingVars.API_PORT || exampleVars.API_PORT || '3000'
    const apiPortStr = await prompt('API port', initialPort)
    ports.api = Number.parseInt(apiPortStr, 10) || 3000
  }
  else if (availableApps.api) {
    const apiEnvPath = join(projectRoot, 'apps/api/.env')
    const existingVars = parseEnvFile(apiEnvPath)
    ports.api = Number.parseInt(existingVars.API_PORT || '3000', 10)
  }

  if (availableApps.webSpa && needsPortConfig.includes('Web SPA')) {
    const webSpaExamplePath = join(projectRoot, 'apps/web-spa/.env.example')
    const webSpaEnvPath = join(projectRoot, 'apps/web-spa/.env')
    const envExists = existsSync(webSpaEnvPath)
    const existingVars = envExists ? parseEnvFile(webSpaEnvPath) : {}
    const exampleVars = parseEnvFile(webSpaExamplePath)
    const initialPort = existingVars.VITE_PORT || exampleVars.VITE_PORT || '5173'
    const webSpaPortStr = await prompt('Web SPA port', initialPort)
    ports.webSpa = Number.parseInt(webSpaPortStr, 10) || 5173
  }

  if (availableApps.webSsr && needsPortConfig.includes('Web SSR')) {
    const webSsrExamplePath = join(projectRoot, 'apps/web-ssr/.env.example')
    const webSsrEnvPath = join(projectRoot, 'apps/web-ssr/.env')
    const envExists = existsSync(webSsrEnvPath)
    const existingVars = envExists ? parseEnvFile(webSsrEnvPath) : {}
    const exampleVars = parseEnvFile(webSsrExamplePath)
    const initialPort = existingVars.PORT || exampleVars.PORT || '5174'
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
  const missingVars = envExists ? getMissingVariables(rootExamplePath, rootEnvPath) : Object.keys(exampleVars)

  const smtpVars = ['SMTP_PORT', 'SMTP_PORT_WEB']
  const needsSmtpConfig = smtpVars.some(v => missingVars.includes(v))

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
    ? await prompt('MailDev web port', existingVars.SMTP_PORT_WEB || exampleVars.SMTP_PORT_WEB || '1080')
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

function checkEnvFiles(availableApps: AvailableApps): EnvFileInfo[] {
  const envFiles: Array<{ from: string, to: string }> = [
    { from: '.env.example', to: '.env' },
  ]

  if (availableApps.api) {
    envFiles.push({ from: 'apps/api/.env.example', to: 'apps/api/.env' })
  }

  if (availableApps.webSpa) {
    envFiles.push({ from: 'apps/web-spa/.env.example', to: 'apps/web-spa/.env' })
  }

  if (availableApps.webSsr) {
    envFiles.push({ from: 'apps/web-ssr/.env.example', to: 'apps/web-ssr/.env' })
  }

  if (availableApps.openapiGenerator) {
    envFiles.push({ from: 'packages/openapi-generator/.env.example', to: 'packages/openapi-generator/.env' })
  }

  return envFiles.map(({ from, to }) => {
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
        console.log(`  ${colorize('⚠', 'yellow')} ${colorize(to, 'dim')} exists but missing variables: ${colorize(missingVars.join(', '), 'yellow')}`)
      }
      else {
        console.log(`  ${colorize('✓', 'green')} ${colorize(to, 'dim')} exists and is complete`)
      }
      continue
    }

    if (existsSync(fromPath)) {
      copyFileSync(fromPath, toPath)
      console.log(`  ${colorize('✓', 'green')} Copied ${colorize(from, 'dim')} → ${colorize(to, 'dim')}`)
    }
    else {
      console.log(`  ${colorize('⚠', 'yellow')} File not found: ${colorize(from, 'dim')}`)
    }
  }
}

function updateEnvFile(filePath: string, replacements: Record<string, string>, onlyMissing: boolean = false): void {
  if (!existsSync(filePath)) {
    console.log(`  ${colorize('⚠', 'yellow')} File not found: ${colorize(filePath, 'dim')}`)
    return
  }

  let content = readFileSync(filePath, 'utf-8')
  const existingVars = parseEnvFile(filePath)
  let updated = false

  for (const [key, value] of Object.entries(replacements)) {
    if (onlyMissing && key in existingVars && existingVars[key]) {
      continue
    }

    const regex = new RegExp(`^${key}=.*$`, 'm')
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`)
      updated = true
    }
    else {
      content += `\n${key}=${value}`
      updated = true
    }
  }

  if (updated) {
    writeFileSync(filePath, content, 'utf-8')
  }
}

function updatePackageJsonName(packagePath: string, newName: string): void {
  if (!existsSync(packagePath)) {
    return
  }

  const content = readFileSync(packagePath, 'utf-8')
  const packageJson = JSON.parse(content)
  packageJson.name = newName

  writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf-8')
}

function updatePackageJsonDependencies(packagePath: string, oldPrefix: string, newPrefix: string): void {
  if (!existsSync(packagePath)) {
    return
  }

  const content = readFileSync(packagePath, 'utf-8')
  const packageJson = JSON.parse(content)
  const preservePackages = new Set<string>(['@lonestone/nzoth'])

  const updateDependenciesSection = (deps: Record<string, string> | undefined): Record<string, string> | undefined => {
    if (!deps) {
      return deps
    }

    const updatedDeps: Record<string, string> = {}
    for (const [key, value] of Object.entries(deps)) {
      if (preservePackages.has(key)) {
        updatedDeps[key] = value
      }
      else if (key.startsWith(oldPrefix)) {
        const newKey = key.replace(oldPrefix, newPrefix)
        updatedDeps[newKey] = value
      }
      else {
        updatedDeps[key] = value
      }
    }
    return updatedDeps
  }

  packageJson.dependencies = updateDependenciesSection(packageJson.dependencies)
  packageJson.devDependencies = updateDependenciesSection(packageJson.devDependencies)
  packageJson.peerDependencies = updateDependenciesSection(packageJson.peerDependencies)

  writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf-8')
}

function updateDockerCompose(projectName: string): void {
  const dockerComposePath = join(projectRoot, 'docker-compose.yml')
  if (!existsSync(dockerComposePath)) {
    return
  }

  let content = readFileSync(dockerComposePath, 'utf-8')
  const oldNames = ['boilerstone', 'lonestone']
  let updated = false

  for (const oldName of oldNames) {
    const regex = new RegExp(oldName, 'g')
    if (regex.test(content)) {
      content = content.replace(regex, projectName)
      updated = true
    }
  }

  if (updated) {
    writeFileSync(dockerComposePath, content, 'utf-8')
    console.log(`  ${colorize('✓', 'green')} Updated ${colorize('docker-compose.yml', 'dim')}`)
  }
}

interface PackageJson {
  scripts?: Record<string, string>
  [key: string]: unknown
}

function updateRootScripts(packageJson: PackageJson, oldPrefix: string, newPrefix: string): PackageJson {
  if (!packageJson.scripts) {
    return packageJson
  }

  const scriptsToRewrite = ['dev', 'generate', 'schematics:module', 'docs-only']
  const nextScripts: Record<string, string> = {}

  for (const [key, value] of Object.entries<string>(packageJson.scripts)) {
    if (scriptsToRewrite.includes(key)) {
      nextScripts[key] = value.replaceAll(oldPrefix, newPrefix)
    }
    else {
      nextScripts[key] = value
    }
  }

  return {
    ...packageJson,
    scripts: nextScripts,
  }
}

async function renameProjects(projectName: string, availableApps: AvailableApps): Promise<void> {
  console.log(`\n${colorize('📦 Renaming project packages', 'cyan')}\n`)

  const oldPrefix = '@boilerstone'
  const newPrefix = `@${projectName}`

  // Update root package.json
  const rootPackagePath = join(projectRoot, 'package.json')
  if (existsSync(rootPackagePath)) {
    const content = readFileSync(rootPackagePath, 'utf-8')
    let packageJson = JSON.parse(content)
    packageJson.name = projectName
    packageJson = updateRootScripts(packageJson, oldPrefix, newPrefix)
    writeFileSync(rootPackagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf-8')
    console.log(`  ${colorize('✓', 'green')} Updated ${colorize('package.json', 'dim')}`)
  }

  // Update apps
  const appsToUpdate: Array<{ path: string, name: string, condition: boolean }> = [
    { path: 'apps/api/package.json', name: 'api', condition: availableApps.api },
    { path: 'apps/web-spa/package.json', name: 'web-spa', condition: availableApps.webSpa },
    { path: 'apps/web-ssr/package.json', name: 'web-ssr', condition: availableApps.webSsr },
    { path: 'apps/documentation/package.json', name: 'documentation', condition: true },
  ]

  for (const { path, name, condition } of appsToUpdate) {
    if (!condition) {
      continue
    }

    const packagePath = join(projectRoot, path)
    updatePackageJsonName(packagePath, `${newPrefix}/${name}`)
    updatePackageJsonDependencies(packagePath, oldPrefix, newPrefix)
    console.log(`  ${colorize('✓', 'green')} Updated ${colorize(path, 'dim')}`)
  }

  // Update packages
  const packagesToUpdate: Array<{ path: string, name: string, condition: boolean }> = [
    { path: 'packages/ui/package.json', name: 'ui', condition: true },
    { path: 'packages/i18n/package.json', name: 'i18n', condition: true },
    { path: 'packages/openapi-generator/package.json', name: 'openapi-generator', condition: availableApps.openapiGenerator },
  ]

  for (const { path, name, condition } of packagesToUpdate) {
    if (!condition) {
      continue
    }

    const packagePath = join(projectRoot, path)
    updatePackageJsonName(packagePath, `${newPrefix}/${name}`)
    updatePackageJsonDependencies(packagePath, oldPrefix, newPrefix)
    console.log(`  ${colorize('✓', 'green')} Updated ${colorize(path, 'dim')}`)
  }

  console.log(`\n  ${colorize('✓', 'green')} All project packages renamed to ${colorize(`@${projectName}/*`, 'bright')}`)

  // Update docker-compose.yml
  updateDockerCompose(projectName)

  // Run linter with auto-fix to ensure formatting is correct
  console.log(`\n  ${colorize('→', 'cyan')} Running linter with auto-fix...`)
  try {
    await runCommand('pnpm', ['lint:fix'])
    console.log(`  ${colorize('✓', 'green')} Linting completed`)
  }
  catch {
    console.log(`  ${colorize('⚠', 'yellow')} Linting failed, but continuing setup`)
  }

  // Install dependencies
  console.log(`\n  ${colorize('→', 'cyan')} Installing new dependencies...`)
  try {
    await runCommand('pnpm', ['install'])
    console.log(`  ${colorize('✓', 'green')} New dependencies installed`)
  }
  catch {
    console.log(`  ${colorize('⚠', 'yellow')} New dependencies installation failed, but continuing setup`)
  }
}

function buildTrustedOrigins(
  config: EnvConfig,
  mobileConfig: MobileConfig | null,
  apiEnvPath: string,
): string {
  const examplePath = apiEnvPath.replace(/\.env$/, '.env.example')
  const existingVars = parseEnvFile(existsSync(apiEnvPath) ? apiEnvPath : examplePath)
  const existingOrigins = (existingVars.TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((o: string) => o.trim())
    .filter(Boolean)

  const localhostFromFile = existingOrigins.filter(
    (origin: string) => origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:'),
  )
  const nonLocalhostOrigins = existingOrigins.filter(
    (origin: string) => !origin.startsWith('http://localhost:') && !origin.startsWith('https://localhost:'),
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

  const mobileSchemeOrigin = mobileConfig ? `${mobileConfig.scheme}://*` : undefined
  const extraFromMobile = mobileSchemeOrigin && !nonLocalhostOrigins.includes(mobileSchemeOrigin)
    ? [mobileSchemeOrigin]
    : []

  return [...localhostMerged, ...nonLocalhostOrigins, ...extraFromMobile].join(',')
}

function updateAllEnvFiles(config: EnvConfig, availableApps: AvailableApps, mobileConfig: MobileConfig | null): void {
  console.log(`\n${colorize('✏️  Updating .env files', 'cyan')}\n`)

  // Root .env (docker-compose) - update all configured vars
  const rootUpdates: Record<string, string> = {}
  rootUpdates.DATABASE_USER = config.database.user
  rootUpdates.DATABASE_PASSWORD = config.database.password
  rootUpdates.DATABASE_NAME = config.database.name
  rootUpdates.DATABASE_PORT = config.database.port.toString()
  rootUpdates.SMTP_PORT = config.smtp.port.toString()
  rootUpdates.SMTP_PORT_WEB = config.smtp.portWeb.toString()

  if (Object.keys(rootUpdates).length > 0) {
    updateEnvFile(join(projectRoot, '.env'), rootUpdates, false)
  }

  // API .env
  if (availableApps.api && config.ports.api) {
    const apiEnvPath = join(projectRoot, 'apps/api/.env')
    const trustedOrigins = buildTrustedOrigins(config, mobileConfig, apiEnvPath)
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
    const apiUrl = `http://localhost:${config.ports.api}`
    updateEnvFile(openapiEnvPath, { API_URL: apiUrl }, false)
  }

  console.log(`  ${colorize('✓', 'green')} Configuration values have been updated in .env files`)
}

async function main(): Promise<void> {
  console.log(`\n${colorize('🚀 Development Environment Setup', 'bright')}\n`)

  try {
    // Detect available applications
    const availableApps = detectAvailableApps()

    console.log(`${colorize('📦 Detected Applications:', 'cyan')}`)
    if (availableApps.api)
      console.log(`  ${colorize('✓', 'green')} ${colorize('API', 'bright')}`)
    if (availableApps.webSpa)
      console.log(`  ${colorize('✓', 'green')} ${colorize('Web SPA', 'bright')}`)
    if (availableApps.webSsr)
      console.log(`  ${colorize('✓', 'green')} ${colorize('Web SSR', 'bright')}`)
    if (availableApps.openapiGenerator)
      console.log(`  ${colorize('✓', 'green')} ${colorize('OpenAPI Generator', 'bright')}`)

    // Check .env files (but don't copy yet)
    const envFilesInfo = checkEnvFiles(availableApps)

    // Prompt for project name
    const projectName = await prompt('Project name', 'my-project')

    // Update package.json files for detected applications with the project name
    await renameProjects(projectName, availableApps)

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

    console.log(`\n${colorize('✅ Setup completed successfully!', 'green')}`)
    console.log(`\n${colorize('📝 Configuration Summary:', 'cyan')}`)
    console.log(`  ${colorize('Database:', 'bright')} ${colorize(`${config.database.user}@${config.database.host}:${config.database.port}/${config.database.name}`, 'dim')}`)
    if (config.ports.api) {
      console.log(`  ${colorize('API:', 'bright')} ${colorize(`http://localhost:${config.ports.api}`, 'blue')}`)
    }
    if (config.ports.webSpa) {
      console.log(`  ${colorize('Web SPA:', 'bright')} ${colorize(`http://localhost:${config.ports.webSpa}`, 'blue')}`)
    }
    if (config.ports.webSsr) {
      console.log(`  ${colorize('Web SSR:', 'bright')} ${colorize(`http://localhost:${config.ports.webSsr}`, 'blue')}`)
    }
    console.log(`  ${colorize('SMTP:', 'bright')} ${colorize(`localhost:${config.smtp.port}`, 'dim')} ${colorize(`(Web: ${config.smtp.portWeb})`, 'dim')}`)

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
            }
            catch (error) {
              console.error(`\n  ${colorize('⚠', 'yellow')} Migration failed:`, error)
              console.log(`  ${colorize('You can run migrations manually later with:', 'dim')} ${colorize('pnpm --filter=api db:migrate:up', 'bright')}`)
            }
          }
          else {
            console.log(`  ${colorize('→', 'cyan')} Skipped migrations. Run manually with: ${colorize('pnpm --filter=api db:migrate:up', 'bright')}`)
          }
        }
        else if (!dbReady && availableApps.api) {
          console.log(`  ${colorize('→', 'cyan')} Database not ready. Run migrations manually with: ${colorize('pnpm --filter=api db:migrate:up', 'bright')}`)
        }
      }
      catch (error) {
        console.error(`\n  ${colorize('⚠', 'yellow')} Failed to start Docker:`, error)
        console.log(`  ${colorize('You can start Docker manually with:', 'dim')} ${colorize('pnpm docker:up', 'bright')}`)
      }
    }
    else {
      console.log(`  ${colorize('→', 'cyan')} Skipped Docker. Start manually with: ${colorize('pnpm docker:up', 'bright')}`)
      if (availableApps.api) {
        console.log(`  ${colorize('→', 'cyan')} Migrations skipped (requires Docker). Run with: ${colorize('pnpm --filter=api db:migrate:up', 'bright')}`)
      }
    }

    // Invite to start dev
    console.log(`\n${colorize('🎉 Setup complete!', 'green')}`)
    console.log(`\n${colorize('Next steps:', 'cyan')}`)

    let step = 1
    if (!dockerStarted) {
      console.log(`  ${colorize(`${step}.`, 'bright')} Start Docker services: ${colorize('pnpm docker:up', 'blue')}`)
      step++
      if (availableApps.api) {
        console.log(`  ${colorize(`${step}.`, 'bright')} Run migrations: ${colorize('pnpm --filter=api db:migrate:up', 'blue')}`)
        step++
      }
    }
    console.log(`  ${colorize(`${step}.`, 'bright')} Start development: ${colorize('pnpm dev', 'blue')}\n`)
  }
  catch (error) {
    console.error(`\n${colorize('❌ Error during setup:', 'red')}`, error)
    process.exit(1)
  }
}

main()
