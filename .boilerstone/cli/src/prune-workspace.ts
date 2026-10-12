import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { OPTIONAL_PACKAGES, WEB_APPS, type WebApp } from './apps.js'

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const

interface Manifest {
  name?: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  [key: string]: unknown
}

interface WorkspacePackage {
  folder: string
  name: string
  dependencies: string[]
}

export interface PruneResult {
  /** Folders deleted, relative to the root, for example `apps/web-ssr`. */
  removedApps: string[]
  /** Folders deleted, relative to the root, for example `packages/ui`. */
  removedPackages: string[]
}

function readJson<T>(filePath: string): T {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as T
  } catch (error) {
    throw new Error(
      `Cannot read ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

function readManifest(folderPath: string): Manifest | undefined {
  const manifestPath = join(folderPath, 'package.json')
  return existsSync(manifestPath) ? readJson<Manifest>(manifestPath) : undefined
}

function dependencyNames(manifest: Manifest | undefined): string[] {
  return DEPENDENCY_FIELDS.flatMap((field) => Object.keys(manifest?.[field] ?? {}))
}

function listFolders(parentPath: string): string[] {
  if (!existsSync(parentPath)) {
    return []
  }
  return readdirSync(parentPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

function readPackages(rootPath: string): WorkspacePackage[] {
  const packages: WorkspacePackage[] = []
  for (const folder of listFolders(join(rootPath, 'packages'))) {
    const manifest = readManifest(join(rootPath, 'packages', folder))
    // A package without a name cannot be a dependency of anything. It is left alone.
    if (typeof manifest?.name === 'string' && manifest.name) {
      packages.push({ folder, name: manifest.name, dependencies: dependencyNames(manifest) })
    }
  }
  return packages
}

/**
 * Names of the packages still needed. The roots are the root manifest, the
 * remaining apps and every package that is not optional. From there it follows
 * dependencies, so a package only another optional package uses is kept while
 * that package is kept, and a cycle nobody else depends on is not.
 */
function findNeededPackages(
  packages: readonly WorkspacePackage[],
  rootDependencies: readonly string[],
): Set<string> {
  const byName = new Map(packages.map((pkg) => [pkg.name, pkg]))
  const needed = new Set<string>()
  const queue: string[] = []

  const need = (name: string): void => {
    if (byName.has(name) && !needed.has(name)) {
      needed.add(name)
      queue.push(name)
    }
  }

  for (const pkg of packages) {
    if (!(OPTIONAL_PACKAGES as readonly string[]).includes(pkg.folder)) {
      need(pkg.name)
    }
  }
  rootDependencies.forEach(need)

  for (let name = queue.pop(); name !== undefined; name = queue.pop()) {
    byName.get(name)?.dependencies.forEach(need)
  }
  return needed
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * True when the command names the package. A longer name does not count, so
 * `@acme/ui-kit` is not a mention of `@acme/ui`. A trailing `...` does, as in
 * `pnpm --filter=@acme/ui... build`.
 */
function mentionsPackage(command: string, packageName: string): boolean {
  return new RegExp(`(?<![\\w-])${escapeRegExp(packageName)}(?![\\w-])`).test(command)
}

function removeRootScripts(rootPath: string, packageNames: readonly string[]): void {
  const manifestPath = join(rootPath, 'package.json')
  if (packageNames.length === 0 || !existsSync(manifestPath)) {
    return
  }
  const manifest = readJson<Manifest>(manifestPath)
  const scripts = { ...manifest.scripts }
  let changed = false
  for (const [scriptName, command] of Object.entries(scripts)) {
    if (
      typeof command === 'string' &&
      packageNames.some((name) => mentionsPackage(command, name))
    ) {
      delete scripts[scriptName]
      changed = true
    }
  }
  if (changed) {
    writeJson(manifestPath, { ...manifest, scripts })
  }
}

function removeKnipWorkspaces(rootPath: string, folders: readonly string[]): void {
  const configPath = join(rootPath, 'knip.json')
  if (folders.length === 0 || !existsSync(configPath)) {
    return
  }
  const config = readJson<{ workspaces?: Record<string, unknown> }>(configPath)
  const workspaces = config.workspaces
  const present = folders.filter((folder) => workspaces !== undefined && folder in workspaces)
  if (!workspaces || present.length === 0) {
    return
  }
  for (const folder of present) {
    delete workspaces[folder]
  }
  writeJson(configPath, config)
}

/**
 * Removes the web apps that are not in `apps`, then the optional packages
 * (see `OPTIONAL_PACKAGES`) that nothing left depends on. Also drops the root
 * scripts that run a removed package and its `knip.json` workspace entries.
 *
 * Packages are found by the `name` in their own `package.json`, so this works
 * before and after the scope rename. Docs, workflows, `pnpm-workspace.yaml`,
 * the lockfile and env files are not touched.
 */
export function pruneWorkspace(rootPath: string, apps: readonly WebApp[]): PruneResult {
  const removedApps: string[] = []
  for (const app of WEB_APPS) {
    const folder = `apps/${app}`
    if (!apps.includes(app) && existsSync(join(rootPath, folder))) {
      rmSync(join(rootPath, folder), { recursive: true, force: true })
      removedApps.push(folder)
    }
  }

  const packages = readPackages(rootPath)
  const rootDependencies = [
    ...dependencyNames(readManifest(rootPath)),
    ...listFolders(join(rootPath, 'apps')).flatMap((folder) =>
      dependencyNames(readManifest(join(rootPath, 'apps', folder))),
    ),
  ]
  const needed = findNeededPackages(packages, rootDependencies)

  const removed = OPTIONAL_PACKAGES.flatMap((folder) => {
    const pkg = packages.find((candidate) => candidate.folder === folder)
    return pkg && !needed.has(pkg.name) ? [pkg] : []
  })
  for (const pkg of removed) {
    rmSync(join(rootPath, 'packages', pkg.folder), { recursive: true, force: true })
  }
  const removedPackages = removed.map((pkg) => `packages/${pkg.folder}`)

  removeRootScripts(
    rootPath,
    removed.map((pkg) => pkg.name),
  )
  removeKnipWorkspaces(rootPath, [...removedApps, ...removedPackages])

  return { removedApps, removedPackages }
}
