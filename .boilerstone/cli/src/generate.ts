import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import {
  type PackageJsonShape,
  PRODUCER_ARTIFACTS,
  TEMPLATE_ROCK_SCRIPT_COMMAND,
  wireGeneratedPackageJson,
} from './boilerplate-core.js'
import { trackingState } from './tracking-state.js'
import { colorize, isolatedGitEnv, runFileSync } from './utils.js'

const TEMPLATE_SCOPE = '@boilerstone'
const defaultBoilerplateRemote = 'https://github.com/lonestone/lonestone-boilerplate.git'

// Producer-only paths dropped from a freshly generated project. The
// `.boilerstone/` subset is derived from PRODUCER_ARTIFACTS so the two lists
// cannot drift.
export const PRODUCER_FILES_TO_REMOVE = [
  '.claude/skills/boilerstone-release',
  '.cursor/skills/boilerstone-release',
  '.claude/skills/boilerstone-intention',
  '.cursor/skills/boilerstone-intention',
  '.claude/skills/boilerstone-init',
  '.cursor/skills/boilerstone-init',
  ...PRODUCER_ARTIFACTS.map((artifact) => `.boilerstone/${artifact}`),
]

export interface GenerateProjectOptions {
  projectName: string
  /** Release the project is generated from; `rock` is pinned to it. */
  sourceVersion: string
  sourceCommit?: string
  /** Defaults to the public boilerplate repository. */
  remote?: string
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf-8')) as T
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

function normalizeGitRemote(value: string): string {
  return value
    .trim()
    .replace(/^git@github\.com:/, 'https://github.com/')
    .replace(/^ssh:\/\/git@github\.com\//, 'https://github.com/')
    .replace(/^(https?:\/\/)[^/]*@/i, '$1')
    .replace(/\/$/, '')
    .replace(/\.git$/, '')
    .toLowerCase()
}

export function isBoilerplateMaintainerCheckout(rootPath: string): boolean {
  try {
    const originUrl = runFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd: rootPath,
      stdio: ['ignore', 'pipe', 'ignore'],
      env: isolatedGitEnv(),
    })

    return normalizeGitRemote(originUrl) === normalizeGitRemote(defaultBoilerplateRemote)
  } catch {
    return false
  }
}

/**
 * True when the template's own `pnpm rock` runs the published CLI. Releases up
 * to v1.1.0 vendored their setup script instead and cannot be generated here.
 */
export function isPublishedCliTemplate(rootPath: string): boolean {
  const pkgPath = join(rootPath, 'package.json')
  if (!existsSync(pkgPath)) {
    return false
  }
  return readJson<PackageJsonShape>(pkgPath).scripts?.rock === TEMPLATE_ROCK_SCRIPT_COMMAND
}

/**
 * True while a workspace manifest (root, `apps/*`, `packages/*`) still uses
 * the template scope, i.e. the checkout was never generated. The root alone is
 * not enough: it only mentions the scope inside `--filter=` scripts.
 */
export function hasTemplateScope(rootPath: string): boolean {
  const manifests = [
    'package.json',
    ...['apps', 'packages'].flatMap((parent) =>
      existsSync(join(rootPath, parent))
        ? readdirSync(join(rootPath, parent)).map((entry) => join(parent, entry, 'package.json'))
        : [],
    ),
  ]
  return manifests.some((manifest) => {
    const manifestPath = join(rootPath, manifest)
    return (
      existsSync(manifestPath) && readFileSync(manifestPath, 'utf-8').includes(`${TEMPLATE_SCOPE}/`)
    )
  })
}

/** Lowercase letters, digits and dashes: valid as an npm scope and a Docker project name. */
export function isValidProjectName(name: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(name)
}

function removePaths(rootPath: string, paths: readonly string[]): void {
  for (const path of paths) {
    const target = join(rootPath, path)
    if (!existsSync(target)) {
      continue
    }
    try {
      rmSync(target, { recursive: true, force: true })
      console.log(`  ${colorize('✓', 'green')} Removed ${colorize(path, 'dim')}`)
    } catch {
      console.log(`  ${colorize('⚠', 'yellow')} Failed to remove ${colorize(path, 'dim')}`)
    }
  }
}

function stripPnpmWorkspaceEntry(rootPath: string, entry: string): void {
  const workspacePath = join(rootPath, 'pnpm-workspace.yaml')
  if (!existsSync(workspacePath)) {
    return
  }
  const content = readFileSync(workspacePath, 'utf-8')
  const escaped = entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const next = content.replace(new RegExp(`^\\s*-\\s+${escaped}\\s*$`, 'm'), '')
  if (next !== content) {
    writeFileSync(workspacePath, next, 'utf-8')
    console.log(
      `  ${colorize('✓', 'green')} Removed ${colorize(entry, 'dim')} from ${colorize('pnpm-workspace.yaml', 'dim')}`,
    )
  }
}

function stripReleasePleaseCliExtraFile(rootPath: string): void {
  const configPath = join(rootPath, 'release-please-config.json')
  if (!existsSync(configPath)) {
    return
  }
  const config = readJson<{
    packages?: Record<string, { 'extra-files'?: Array<string | { path?: string }> }>
  }>(configPath)
  const rootPackage = config.packages?.['.']
  const extraFiles = rootPackage?.['extra-files']
  if (!rootPackage || !Array.isArray(extraFiles)) {
    return
  }
  const next = extraFiles.filter((file) =>
    typeof file === 'string'
      ? file !== '.boilerstone/cli/package.json'
      : file.path !== '.boilerstone/cli/package.json',
  )
  if (next.length === extraFiles.length) {
    return
  }
  if (next.length === 0) {
    delete rootPackage['extra-files']
  } else {
    rootPackage['extra-files'] = next
  }
  writeJson(configPath, config)
  console.log(
    `  ${colorize('✓', 'green')} Removed CLI extra-files from ${colorize('release-please-config.json', 'dim')}`,
  )
}

function stripKnipCliWorkspace(rootPath: string): void {
  const configPath = join(rootPath, 'knip.json')
  if (!existsSync(configPath)) {
    return
  }
  const config = readJson<{ workspaces?: Record<string, unknown> }>(configPath)
  if (!config.workspaces?.['.boilerstone/cli']) {
    return
  }
  delete config.workspaces['.boilerstone/cli']
  writeJson(configPath, config)
  console.log(
    `  ${colorize('✓', 'green')} Removed ${colorize('.boilerstone/cli', 'dim')} from ${colorize('knip.json', 'dim')}`,
  )
}

/** Drop the references that point at the CLI sources once `.boilerstone/cli` is gone. */
function stripCliPackageReferences(rootPath: string): void {
  stripPnpmWorkspaceEntry(rootPath, '.boilerstone')
  stripPnpmWorkspaceEntry(rootPath, '.boilerstone/cli')
  stripReleasePleaseCliExtraFile(rootPath)
  stripKnipCliWorkspace(rootPath)
}

/**
 * Switch an existing project's `.boilerstone/` to consumer mode. Only touches
 * `.boilerstone/` and the workspace, release and knip entries that point into
 * it: this runs on client code, so nothing else is ever removed.
 */
export function stripBoilerstoneProducerArtifacts(rootPath: string): void {
  removePaths(
    rootPath,
    PRODUCER_ARTIFACTS.map((artifact) => `.boilerstone/${artifact}`),
  )
  stripCliPackageReferences(rootPath)
}

const WORKSPACE_SCOPE_SKIP_DIRS = new Set([
  '.astro',
  '.boilerstone',
  '.git',
  '.output',
  '.react-router',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'node_modules',
])

const WORKSPACE_SCOPE_SKIP_FILES = new Set(['CHANGELOG.md', 'package-lock.json', 'pnpm-lock.yaml'])

const WORKSPACE_SCOPE_TEXT_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mdc',
  '.mdx',
  '.mjs',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
])

/**
 * Replace `@old-scope/` with `@new-scope/` in project text files, package
 * names and workspace dependencies included. Skips `.boilerstone/`, lockfiles,
 * and the changelog so the upgrade CLI and historical records keep their own
 * names.
 */
export function rewriteWorkspaceScope(
  rootPath: string,
  oldPrefix: string,
  newPrefix: string,
): number {
  if (oldPrefix === newPrefix) {
    return 0
  }

  const oldScoped = `${oldPrefix}/`
  const newScoped = `${newPrefix}/`
  let filesUpdated = 0

  function walk(dirPath: string): void {
    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) {
        continue
      }

      if (entry.isDirectory()) {
        if (WORKSPACE_SCOPE_SKIP_DIRS.has(entry.name)) {
          continue
        }
        walk(join(dirPath, entry.name))
        continue
      }

      if (!entry.isFile() || WORKSPACE_SCOPE_SKIP_FILES.has(entry.name)) {
        continue
      }

      if (!WORKSPACE_SCOPE_TEXT_EXTENSIONS.has(extname(entry.name))) {
        continue
      }

      const filePath = join(dirPath, entry.name)
      const content = readFileSync(filePath, 'utf-8')
      if (!content.includes(oldScoped)) {
        continue
      }

      writeFileSync(filePath, content.replaceAll(oldScoped, newScoped), 'utf-8')
      filesUpdated += 1
    }
  }

  walk(rootPath)
  return filesUpdated
}

function updateDockerCompose(rootPath: string, projectName: string): void {
  const dockerComposePath = join(rootPath, 'docker-compose.yml')
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

function renameWorkspace(rootPath: string, projectName: string): void {
  const pkgPath = join(rootPath, 'package.json')
  const pkg = readJson<PackageJsonShape>(pkgPath)
  writeJson(pkgPath, { ...pkg, name: projectName })

  const newScope = `@${projectName}`
  const rewrittenCount = rewriteWorkspaceScope(rootPath, TEMPLATE_SCOPE, newScope)
  console.log(
    `  ${colorize('✓', 'green')} Renamed ${colorize(`${TEMPLATE_SCOPE}/*`, 'dim')} to ${colorize(`${newScope}/*`, 'bright')} in ${rewrittenCount} files`,
  )

  updateDockerCompose(rootPath, projectName)
}

function wirePublishedCli(rootPath: string, version: string): void {
  const pkgPath = join(rootPath, 'package.json')
  writeJson(pkgPath, wireGeneratedPackageJson(readJson<PackageJsonShape>(pkgPath), version))
  console.log(
    `  ${colorize('✓', 'green')} package.json: scripts run ${colorize(`@lonestone/cli`, 'dim')} through pnpm dlx (rock pinned to ${version}), no CLI dependency`,
  )
}

/**
 * Turn a checkout of a template release into a new project, in place. Meant
 * for a staging directory that nobody else uses yet: it removes producer
 * files without asking. Existing projects go through
 * `stripBoilerstoneProducerArtifacts` instead.
 */
export function generateProject(rootPath: string, options: GenerateProjectOptions): void {
  console.log(`\n${colorize('🧱 Generating the project', 'cyan')}\n`)

  removePaths(rootPath, PRODUCER_FILES_TO_REMOVE)
  stripCliPackageReferences(rootPath)
  renameWorkspace(rootPath, options.projectName)
  wirePublishedCli(rootPath, options.sourceVersion)

  // The template ships the producer's own state file; the new project starts
  // from the release it was generated from.
  trackingState.write(
    rootPath,
    trackingState.create({
      currentVersion: options.sourceVersion,
      remote: options.remote,
      commit: options.sourceCommit,
    }),
  )
  console.log(
    `  ${colorize('✓', 'green')} Created ${colorize('.boilerstone/boilerplate.json', 'dim')} (source ${options.sourceVersion})`,
  )
}
