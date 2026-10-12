/**
 * Generates a project from the working tree for one `--apps` choice, then
 * proves that it installs, lints, typechecks and builds.
 *
 *   pnpm exec tsx .boilerstone/cli/scripts/check-combo.ts --apps web-spa,web-ssr
 *   pnpm exec tsx .boilerstone/cli/scripts/check-combo.ts --apps none
 *
 * It copies the files git knows about (tracked, or untracked and not ignored),
 * so local changes that are not committed yet are tested too. It does not run
 * the tests (the API tests need Docker, and the main CI job runs them) or
 * `pnpm rock` (it asks questions).
 */
import { execFileSync, spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  ALWAYS_INCLUDED_APPS,
  OPTIONAL_PACKAGES,
  parseAppsOption,
  WEB_APPS,
  type WebApp,
} from '../src/apps.js'
import { generateProject } from '../src/generate.js'
import { isolatedGitEnv } from '../src/utils.js'

const PROJECT_NAME = 'combo-app'
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const cliVersion = (
  JSON.parse(readFileSync(join(repoRoot, '.boilerstone/cli/package.json'), 'utf-8')) as {
    version: string
  }
).version

// Never copied, wherever they appear in a path.
const SKIPPED_FOLDERS = new Set(['node_modules', '.git', 'dist'])

/** Splits a path into folders, so it also works with a Windows separator. */
function pathSegments(path: string): string[] {
  return path.split(/[\\/]/)
}

function readAppsArgument(argv: readonly string[]): WebApp[] {
  let value: string | undefined
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--apps') {
      value = argv[index + 1]
      index += 1
    } else if (argument.startsWith('--apps=')) {
      value = argument.slice('--apps='.length)
    } else {
      throw new Error(`Unknown argument '${argument}'. Usage: check-combo.ts --apps <list|none>`)
    }
  }
  if (value === undefined) {
    throw new Error(
      'Missing --apps. Usage: check-combo.ts --apps <web-spa,web-ssr|web-spa|web-ssr|none>',
    )
  }
  return parseAppsOption(value)
}

function copyWorkingTree(from: string, to: string): number {
  const listed = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: from, env: isolatedGitEnv(), encoding: 'utf-8', maxBuffer: 256 * 1024 * 1024 },
  )
    .split('\0')
    .filter(Boolean)

  let copied = 0
  for (const file of listed) {
    const segments = pathSegments(file)
    if (segments[0] === '.worktrees' || segments.some((part) => SKIPPED_FOLDERS.has(part))) {
      continue
    }
    const source = join(from, file)
    // A tracked file can be deleted in the working tree and not committed yet.
    // Anything that is not a regular file (a link, a submodule folder) is left out.
    if (!existsSync(source)) {
      continue
    }
    const stat = lstatSync(source)
    if (!stat.isFile()) {
      continue
    }
    const target = join(to, file)
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(source, target)
    chmodSync(target, stat.mode & 0o777)
    copied += 1
  }
  return copied
}

/**
 * Runs one command in the project, with its output on screen. A failure stops
 * the whole check and names the step, unless the step is optional.
 */
function runStep(
  project: string,
  step: string,
  args: readonly string[],
  options: { optional?: boolean; env?: NodeJS.ProcessEnv } = {},
): boolean {
  const [command, ...rest] = args
  console.log(`\n--- ${step}: ${args.join(' ')}`)
  const result = spawnSync(command, rest, {
    cwd: project,
    env: { ...isolatedGitEnv(), ...options.env },
    stdio: 'inherit',
  })
  if (result.status === 0) {
    return true
  }
  const reason = result.error?.message ?? `exit code ${result.status ?? result.signal}`
  if (options.optional) {
    console.log(`Note: step '${step}' failed (${reason}). \`init\` allows this one to fail.`)
    return false
  }
  throw new Error(`Step '${step}' failed (${reason}): ${args.join(' ')}`)
}

function readJsonFile<T>(project: string, path: string): T {
  return JSON.parse(readFileSync(join(project, path), 'utf-8')) as T
}

/**
 * Every folder a project can have, and whether this choice must keep it. It
 * is written by hand on purpose: deriving it from the manifests would test the
 * pruning code against its own logic. Update it when a web app starts or stops
 * using a shared package.
 */
function expectedFolders(apps: readonly WebApp[]): Record<string, boolean> {
  const hasWebApp = apps.length > 0
  const packages: Record<(typeof OPTIONAL_PACKAGES)[number], boolean> = {
    ui: hasWebApp,
    'openapi-generator': hasWebApp,
    i18n: apps.includes('web-spa'),
  }
  return {
    ...Object.fromEntries(ALWAYS_INCLUDED_APPS.map((app) => [`apps/${app}`, true])),
    ...Object.fromEntries(WEB_APPS.map((app) => [`apps/${app}`, apps.includes(app)])),
    ...Object.fromEntries(OPTIONAL_PACKAGES.map((name) => [`packages/${name}`, packages[name]])),
  }
}

function removedFolders(apps: readonly WebApp[]): string[] {
  return Object.entries(expectedFolders(apps))
    .filter(([, kept]) => !kept)
    .map(([folder]) => folder)
}

/** Checks the project right after generation, before anything is installed. */
function checkStructure(project: string, apps: readonly WebApp[]): string[] {
  const problems: string[] = []

  for (const [folder, kept] of Object.entries(expectedFolders(apps))) {
    const exists = existsSync(join(project, folder))
    if (kept && !exists) {
      problems.push(`${folder} is missing, but this choice must keep it`)
    } else if (!kept && exists) {
      problems.push(`${folder} still exists, but this choice must remove it`)
    }
  }

  const state = readJsonFile<{ apps?: unknown }>(project, '.boilerstone/boilerplate.json')
  if (JSON.stringify(state.apps) !== JSON.stringify(apps)) {
    problems.push(
      `.boilerstone/boilerplate.json has apps ${JSON.stringify(state.apps)}, expected ${JSON.stringify(apps)}`,
    )
  }

  const rootManifest = readJsonFile<{ scripts?: Record<string, string> }>(project, 'package.json')
  const hasGenerator = existsSync(join(project, 'packages/openapi-generator'))
  const hasGenerateScript = rootManifest.scripts?.generate !== undefined
  if (hasGenerator && !hasGenerateScript) {
    problems.push(
      'The root package.json lost its generate script, but packages/openapi-generator is kept',
    )
  } else if (!hasGenerator && hasGenerateScript) {
    problems.push(
      'The root package.json still has a generate script, but packages/openapi-generator was removed',
    )
  }

  const workspaces = Object.keys(
    readJsonFile<{ workspaces?: Record<string, unknown> }>(project, 'knip.json').workspaces ?? {},
  )
  for (const folder of removedFolders(apps)) {
    if (workspaces.includes(folder)) {
      problems.push(`knip.json still has a workspace for the removed folder ${folder}`)
    }
  }

  return problems
}

/** Checks the lockfile that the install rewrote: it must not mention removed folders. */
function checkLockfile(project: string, apps: readonly WebApp[]): string[] {
  const lockfile = readFileSync(join(project, 'pnpm-lock.yaml'), 'utf-8')
  const problems: string[] = []
  for (const folder of removedFolders(apps)) {
    // A longer name does not count: `packages/ui-kit` is not `packages/ui`.
    const mention = new RegExp(`(?<![\\w-])${folder}(?![\\w-])`).exec(lockfile)
    if (mention) {
      const line = lockfile.slice(0, mention.index).split('\n').length
      problems.push(`pnpm-lock.yaml still mentions the removed folder ${folder} (line ${line})`)
    }
  }
  return problems
}

function failOnProblems(title: string, problems: readonly string[]): void {
  if (problems.length > 0) {
    throw new Error(`${title}:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`)
  }
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.round(milliseconds / 1000)
  return `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, '0')}s`
}

function main(): void {
  const startedAt = Date.now()
  let apps: WebApp[]
  try {
    apps = readAppsArgument(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
  const choice = apps.length > 0 ? apps.join(',') : 'none'

  const tempRoot = mkdtempSync(join(tmpdir(), 'check-combo-'))
  const project = join(tempRoot, PROJECT_NAME)

  try {
    console.log(`Checking --apps ${choice} in ${project}`)
    mkdirSync(project)
    const copied = copyWorkingTree(repoRoot, project)
    console.log(`Copied ${copied} files from ${repoRoot}`)

    generateProject(project, { projectName: PROJECT_NAME, sourceVersion: cliVersion, apps })
    failOnProblems(
      'The generated project is not what this choice should give',
      checkStructure(project, apps),
    )

    runStep(project, 'git init', ['git', 'init', '-q'])
    // Explicit: under CI=true pnpm defaults to a frozen install, and the
    // lockfile still carries the template names, as it does in `init`.
    runStep(project, 'install', ['pnpm', 'install', '--no-frozen-lockfile'])
    failOnProblems('The lockfile is not what this choice should give', checkLockfile(project, apps))

    runStep(project, 'fmt', ['pnpm', 'fmt'], { optional: true })
    runStep(project, 'lint', ['pnpm', 'lint'])
    runStep(project, 'typecheck', ['pnpm', 'typecheck'])
    runStep(project, 'knip', ['pnpm', 'knip'])
    // pnpm exits 0 when the filter matches nothing, as when packages/i18n is gone.
    runStep(project, 'check-translations', [
      'pnpm',
      '--filter',
      `@${PROJECT_NAME}/i18n`,
      'check-translations',
    ])
    runStep(project, 'build', ['pnpm', 'build'], { env: { NODE_ENV: 'production', CI: 'true' } })

    rmSync(tempRoot, { recursive: true, force: true })
    console.log(`\ncheck-combo OK: --apps ${choice} in ${formatDuration(Date.now() - startedAt)}`)
  } catch (error) {
    console.error(`\n${error instanceof Error ? error.message : String(error)}`)
    console.error(
      `\ncheck-combo FAILED: --apps ${choice} after ${formatDuration(Date.now() - startedAt)}`,
    )
    console.error(`The generated project was kept in ${project}`)
    process.exitCode = 1
  }
}

main()
