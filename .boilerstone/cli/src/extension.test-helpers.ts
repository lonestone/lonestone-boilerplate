import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { trackingState } from './tracking-state'
import { isolatedGitEnv } from './utils'

/** Minimal extension that uses every step type, for the extension specs. */
export const SAMPLE_EXTENSION = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'extension-sample',
)

const temporaryPaths: string[] = []

export function removeTemporaryPaths(): void {
  for (const path of temporaryPaths.splice(0)) {
    rmSync(path, { recursive: true, force: true })
  }
}

export function makeTemporaryDirectory(prefix: string): string {
  const path = mkdtempSync(join(tmpdir(), prefix))
  temporaryPaths.push(path)
  return path
}

export function git(cwd: string, args: string[]): string {
  return execFileSync(
    'git',
    [
      '-c',
      'user.email=test@example.com',
      '-c',
      'user.name=Test',
      '-c',
      'commit.gpgsign=false',
      '-c',
      'tag.gpgsign=false',
      '-c',
      'init.defaultBranch=main',
      ...args,
    ],
    { cwd, env: isolatedGitEnv(), encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim()
}

export function gitStatus(cwd: string): string {
  return git(cwd, ['status', '--porcelain', '--untracked-files=all'])
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

export interface SampleProjectOptions {
  apps?: string[]
  version?: string
  withLogo?: boolean
}

/** A committed project shaped like a generated boilerstone project, reduced to what the sample extension touches. */
export function createSampleProject(options: SampleProjectOptions = {}): string {
  const apps = options.apps ?? ['web-spa']
  const root = makeTemporaryDirectory('boilerstone-extension-project-')

  writeJson(join(root, 'package.json'), { name: 'acme', private: true })
  for (const app of apps) {
    writeJson(join(root, 'apps', app, 'package.json'), {
      name: `@acme/${app}`,
      private: true,
      scripts: { dev: 'vite' },
    })
    writeFileSync(join(root, 'apps', app, 'main.txt'), 'const a = 1\n// end\n')
  }
  writeFileSync(join(root, '.env.example'), 'TRUSTED_ORIGINS=http://localhost:5173\n')
  writeFileSync(join(root, '.gitignore'), 'node_modules\n')
  if (options.withLogo) {
    mkdirSync(join(root, 'assets'))
    writeFileSync(join(root, 'assets', 'logo.txt'), 'logo\n')
  }
  trackingState.write(
    root,
    trackingState.create({ currentVersion: options.version ?? '1.4.0', apps }),
  )

  git(root, ['init', '--quiet'])
  git(root, ['add', '-A'])
  git(root, ['commit', '--quiet', '-m', 'init'])
  return root
}

export interface ExtensionRelease {
  tag: string
  min: string
  below?: string
}

/** A git repository holding the sample extension, with one commit and tag per release. */
export function createExtensionRepository(releases: ExtensionRelease[]): string {
  const root = makeTemporaryDirectory('boilerstone-extension-repo-')
  cpSync(SAMPLE_EXTENSION, root, { recursive: true })
  git(root, ['init', '--quiet'])

  const manifestPath = join(root, 'extension.json')
  for (const release of releases) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
      compatibility: { boilerplate: { min: string; below?: string } }
    }
    manifest.compatibility.boilerplate = {
      min: release.min,
      ...(release.below ? { below: release.below } : {}),
    }
    writeJson(manifestPath, manifest)
    git(root, ['add', '-A'])
    git(root, ['commit', '--quiet', '--allow-empty', '-m', release.tag])
    git(root, ['tag', release.tag])
  }
  return root
}
