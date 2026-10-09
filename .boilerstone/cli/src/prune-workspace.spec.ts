import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import type { WebApp } from './apps'
import { pruneWorkspace } from './prune-workspace'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const temporaryRoots: string[] = []

afterEach(() => {
  for (const rootPath of temporaryRoots.splice(0)) {
    rmSync(rootPath, { recursive: true, force: true })
  }
})

function createRoot(): string {
  const rootPath = mkdtempSync(join(tmpdir(), 'boilerstone-prune-'))
  temporaryRoots.push(rootPath)
  return rootPath
}

function writeFile(rootPath: string, path: string, content: string): void {
  mkdirSync(dirname(join(rootPath, path)), { recursive: true })
  writeFileSync(join(rootPath, path), content, 'utf-8')
}

function writeJson(rootPath: string, path: string, value: unknown): void {
  writeFile(rootPath, path, `${JSON.stringify(value, null, 2)}\n`)
}

function readJson<T = unknown>(rootPath: string, path: string): T {
  return JSON.parse(readFileSync(join(rootPath, path), 'utf-8')) as T
}

interface RootManifest {
  scripts: Record<string, string>
}

function readScripts(rootPath: string): Record<string, string> {
  return readJson<RootManifest>(rootPath, 'package.json').scripts
}

function writeManifest(
  rootPath: string,
  folder: string,
  name: string,
  dependencies: string[] = [],
): void {
  writeJson(rootPath, `${folder}/package.json`, {
    name,
    dependencies: Object.fromEntries(dependencies.map((dependency) => [dependency, 'workspace:*'])),
  })
}

/**
 * The dependency graph of the boilerplate: web-spa uses i18n, openapi-generator
 * and ui, web-ssr uses openapi-generator and ui, ui uses openapi-generator.
 * api and documentation use none of them.
 */
function createWorkspace(scope = '@boilerstone'): string {
  const rootPath = createRoot()
  writeJson(rootPath, 'package.json', {
    name: scope.slice(1),
    scripts: {
      dev: 'pnpm --parallel dev',
      generate: `pnpm --filter=${scope}/openapi-generator run generate`,
      test: 'pnpm -r test',
    },
    devDependencies: { typescript: '^6.0.0' },
  })
  writeJson(rootPath, 'knip.json', {
    workspaces: {
      '.': { ignore: ['.worktrees/**'] },
      'apps/api': { entry: ['src/main.ts!'] },
      'apps/web-spa': { entry: ['app/main.ts!'] },
      'apps/web-ssr': {},
      'apps/documentation': {},
      'packages/openapi-generator': {},
    },
  })
  writeManifest(rootPath, 'apps/api', `${scope}/api`)
  writeManifest(rootPath, 'apps/documentation', `${scope}/documentation`)
  writeManifest(rootPath, 'apps/web-spa', `${scope}/web-spa`, [
    `${scope}/i18n`,
    `${scope}/openapi-generator`,
    `${scope}/ui`,
  ])
  writeManifest(rootPath, 'apps/web-ssr', `${scope}/web-ssr`, [
    `${scope}/openapi-generator`,
    `${scope}/ui`,
  ])
  writeManifest(rootPath, 'packages/ui', `${scope}/ui`, [`${scope}/openapi-generator`])
  writeManifest(rootPath, 'packages/i18n', `${scope}/i18n`)
  writeManifest(rootPath, 'packages/openapi-generator', `${scope}/openapi-generator`)
  return rootPath
}

function listFolders(rootPath: string, parent: string): string[] {
  return readdirSync(join(rootPath, parent), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

const BOTH_APPS: WebApp[] = ['web-spa', 'web-ssr']

describe('pruneWorkspace app combinations', () => {
  it('removes nothing when both web apps are kept', () => {
    const rootPath = createWorkspace()
    const rootManifest = readFileSync(join(rootPath, 'package.json'), 'utf-8')
    const knipConfig = readFileSync(join(rootPath, 'knip.json'), 'utf-8')

    expect(pruneWorkspace(rootPath, BOTH_APPS)).toEqual({ removedApps: [], removedPackages: [] })

    expect(listFolders(rootPath, 'apps')).toEqual(['api', 'documentation', 'web-spa', 'web-ssr'])
    expect(listFolders(rootPath, 'packages')).toEqual(['i18n', 'openapi-generator', 'ui'])
    expect(readFileSync(join(rootPath, 'package.json'), 'utf-8')).toBe(rootManifest)
    expect(readFileSync(join(rootPath, 'knip.json'), 'utf-8')).toBe(knipConfig)
  })

  it('removes web-ssr and keeps every package when only web-spa is kept', () => {
    const rootPath = createWorkspace()

    expect(pruneWorkspace(rootPath, ['web-spa'])).toEqual({
      removedApps: ['apps/web-ssr'],
      removedPackages: [],
    })

    expect(listFolders(rootPath, 'apps')).toEqual(['api', 'documentation', 'web-spa'])
    expect(listFolders(rootPath, 'packages')).toEqual(['i18n', 'openapi-generator', 'ui'])
    expect(readScripts(rootPath).generate).toBeDefined()
  })

  it('removes web-spa and i18n when only web-ssr is kept', () => {
    const rootPath = createWorkspace()

    expect(pruneWorkspace(rootPath, ['web-ssr'])).toEqual({
      removedApps: ['apps/web-spa'],
      removedPackages: ['packages/i18n'],
    })

    expect(listFolders(rootPath, 'apps')).toEqual(['api', 'documentation', 'web-ssr'])
    expect(listFolders(rootPath, 'packages')).toEqual(['openapi-generator', 'ui'])
    expect(readScripts(rootPath).generate).toBeDefined()
  })

  it('removes both apps and every optional package when none is kept', () => {
    const rootPath = createWorkspace()

    expect(pruneWorkspace(rootPath, [])).toEqual({
      removedApps: ['apps/web-spa', 'apps/web-ssr'],
      removedPackages: ['packages/ui', 'packages/i18n', 'packages/openapi-generator'],
    })

    expect(listFolders(rootPath, 'apps')).toEqual(['api', 'documentation'])
    expect(listFolders(rootPath, 'packages')).toEqual([])
  })

  it('keeps the apps that are always included', () => {
    const rootPath = createWorkspace()

    pruneWorkspace(rootPath, [])

    expect(existsSync(join(rootPath, 'apps/api/package.json'))).toBe(true)
    expect(existsSync(join(rootPath, 'apps/documentation/package.json'))).toBe(true)
  })
})

describe('pruneWorkspace root scripts', () => {
  it('removes the generate script only when openapi-generator is removed', () => {
    const kept = createWorkspace()
    pruneWorkspace(kept, ['web-ssr'])
    expect(readScripts(kept).generate).toBe(
      'pnpm --filter=@boilerstone/openapi-generator run generate',
    )

    const removed = createWorkspace()
    pruneWorkspace(removed, [])
    expect(readScripts(removed)).not.toHaveProperty('generate')
  })

  it('leaves the other scripts and fields untouched', () => {
    const rootPath = createWorkspace()

    pruneWorkspace(rootPath, [])

    expect(readJson(rootPath, 'package.json')).toEqual({
      name: 'boilerstone',
      scripts: { dev: 'pnpm --parallel dev', test: 'pnpm -r test' },
      devDependencies: { typescript: '^6.0.0' },
    })
    expect(Object.keys(readJson<Record<string, unknown>>(rootPath, 'package.json'))).toEqual([
      'name',
      'scripts',
      'devDependencies',
    ])
    expect(readFileSync(join(rootPath, 'package.json'), 'utf-8')).toMatch(/\n$/)
  })

  it('does not remove a script that names a longer package name', () => {
    const rootPath = createWorkspace()
    writeManifest(rootPath, 'packages/ui-kit', '@boilerstone/ui-kit')
    writeJson(rootPath, 'package.json', {
      name: 'boilerstone',
      scripts: {
        'build:kit': 'pnpm --filter=@boilerstone/ui-kit build',
        'build:ui': 'pnpm --filter=@boilerstone/ui... build',
        'build:filter-flag': 'pnpm --filter @boilerstone/ui build',
      },
    })

    pruneWorkspace(rootPath, [])

    expect(readScripts(rootPath)).toEqual({
      'build:kit': 'pnpm --filter=@boilerstone/ui-kit build',
    })
  })
})

describe('pruneWorkspace knip.json', () => {
  it('removes the entries of the removed folders and keeps the others', () => {
    const rootPath = createWorkspace()

    pruneWorkspace(rootPath, [])

    expect(readJson(rootPath, 'knip.json')).toEqual({
      workspaces: {
        '.': { ignore: ['.worktrees/**'] },
        'apps/api': { entry: ['src/main.ts!'] },
        'apps/documentation': {},
      },
    })
  })

  it('keeps the entry of a package that stays', () => {
    const rootPath = createWorkspace()

    pruneWorkspace(rootPath, ['web-ssr'])

    expect(
      Object.keys(
        readJson<{ workspaces: Record<string, unknown> }>(rootPath, 'knip.json').workspaces,
      ),
    ).toEqual(['.', 'apps/api', 'apps/web-ssr', 'apps/documentation', 'packages/openapi-generator'])
  })

  it('tolerates a missing knip.json', () => {
    const rootPath = createWorkspace()
    rmSync(join(rootPath, 'knip.json'))

    expect(() => pruneWorkspace(rootPath, [])).not.toThrow()

    expect(existsSync(join(rootPath, 'knip.json'))).toBe(false)
  })

  it('tolerates a knip.json without workspaces or without the removed keys', () => {
    const withoutWorkspaces = createWorkspace()
    writeFile(withoutWorkspaces, 'knip.json', '{ "rules": {} }\n')
    expect(() => pruneWorkspace(withoutWorkspaces, [])).not.toThrow()
    expect(readFileSync(join(withoutWorkspaces, 'knip.json'), 'utf-8')).toBe('{ "rules": {} }\n')

    const withoutKeys = createWorkspace()
    const original = `${JSON.stringify({ workspaces: { 'apps/api': {} } }, null, 2)}\n`
    writeFile(withoutKeys, 'knip.json', original)
    pruneWorkspace(withoutKeys, [])
    expect(readFileSync(join(withoutKeys, 'knip.json'), 'utf-8')).toBe(original)
  })
})

describe('pruneWorkspace package graph', () => {
  it('works with a scope other than the template scope', () => {
    const rootPath = createWorkspace('@acme')

    expect(pruneWorkspace(rootPath, ['web-ssr'])).toEqual({
      removedApps: ['apps/web-spa'],
      removedPackages: ['packages/i18n'],
    })
    expect(listFolders(rootPath, 'packages')).toEqual(['openapi-generator', 'ui'])

    const noApps = createWorkspace('@acme')
    expect(pruneWorkspace(noApps, []).removedPackages).toEqual([
      'packages/ui',
      'packages/i18n',
      'packages/openapi-generator',
    ])
    expect(readScripts(noApps)).not.toHaveProperty('generate')
  })

  it('works with an unscoped package name', () => {
    const rootPath = createRoot()
    writeJson(rootPath, 'package.json', {
      name: 'acme',
      scripts: { generate: 'pnpm --filter=openapi-generator run generate', dev: 'pnpm dev' },
    })
    writeManifest(rootPath, 'apps/api', 'api')
    writeManifest(rootPath, 'apps/web-spa', 'web-spa', ['openapi-generator'])
    writeManifest(rootPath, 'packages/openapi-generator', 'openapi-generator')

    pruneWorkspace(rootPath, ['web-spa'])
    expect(existsSync(join(rootPath, 'packages/openapi-generator'))).toBe(true)

    pruneWorkspace(rootPath, [])
    expect(existsSync(join(rootPath, 'packages/openapi-generator'))).toBe(false)
    expect(readScripts(rootPath)).toEqual({ dev: 'pnpm dev' })
  })

  it('removes optional packages that only depend on each other', () => {
    const rootPath = createRoot()
    writeJson(rootPath, 'package.json', { name: 'acme' })
    writeManifest(rootPath, 'apps/api', '@acme/api')
    writeManifest(rootPath, 'packages/ui', '@acme/ui', ['@acme/i18n'])
    writeManifest(rootPath, 'packages/i18n', '@acme/i18n', ['@acme/ui'])

    expect(pruneWorkspace(rootPath, [])).toEqual({
      removedApps: [],
      removedPackages: ['packages/ui', 'packages/i18n'],
    })
  })

  it('keeps a cycle when an app outside it depends on one member', () => {
    const rootPath = createRoot()
    writeJson(rootPath, 'package.json', { name: 'acme' })
    writeManifest(rootPath, 'apps/web-ssr', '@acme/web-ssr', ['@acme/ui'])
    writeManifest(rootPath, 'packages/ui', '@acme/ui', ['@acme/i18n'])
    writeManifest(rootPath, 'packages/i18n', '@acme/i18n', ['@acme/ui'])

    expect(pruneWorkspace(rootPath, ['web-ssr'])).toEqual({ removedApps: [], removedPackages: [] })
  })

  it('keeps an optional package that a package outside the optional list depends on', () => {
    const rootPath = createWorkspace()
    writeManifest(rootPath, 'packages/shared', '@boilerstone/shared', ['@boilerstone/ui'])

    expect(pruneWorkspace(rootPath, [])).toEqual({
      removedApps: ['apps/web-spa', 'apps/web-ssr'],
      removedPackages: ['packages/i18n'],
    })

    // ui stays, so the package ui depends on stays too.
    expect(listFolders(rootPath, 'packages')).toEqual(['openapi-generator', 'shared', 'ui'])
    expect(readScripts(rootPath).generate).toBeDefined()
  })

  it('keeps an optional package that the root package.json depends on', () => {
    const rootPath = createWorkspace()
    writeJson(rootPath, 'package.json', {
      name: 'boilerstone',
      devDependencies: { '@boilerstone/i18n': 'workspace:*' },
    })

    expect(pruneWorkspace(rootPath, []).removedPackages).toEqual([
      'packages/ui',
      'packages/openapi-generator',
    ])
  })

  it.each(['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'])(
    'follows %s',
    (field) => {
      const rootPath = createRoot()
      writeJson(rootPath, 'package.json', { name: 'acme' })
      writeJson(rootPath, 'apps/web-ssr/package.json', {
        name: '@acme/web-ssr',
        [field]: { '@acme/ui': 'workspace:*' },
      })
      writeManifest(rootPath, 'packages/ui', '@acme/ui')

      expect(pruneWorkspace(rootPath, ['web-ssr'])).toEqual({
        removedApps: [],
        removedPackages: [],
      })
      expect(pruneWorkspace(rootPath, [])).toEqual({
        removedApps: ['apps/web-ssr'],
        removedPackages: ['packages/ui'],
      })
    },
  )

  it('identifies a package by its name and not by its folder', () => {
    const rootPath = createRoot()
    writeJson(rootPath, 'package.json', { name: 'acme' })
    writeManifest(rootPath, 'apps/web-ssr', '@acme/web-ssr', ['@acme/design'])
    writeManifest(rootPath, 'packages/ui', '@acme/design')

    expect(pruneWorkspace(rootPath, ['web-ssr'])).toEqual({ removedApps: [], removedPackages: [] })
  })

  it('ignores dependencies that are not workspace packages', () => {
    const rootPath = createRoot()
    writeJson(rootPath, 'package.json', { name: 'acme' })
    writeManifest(rootPath, 'apps/web-ssr', '@acme/web-ssr', ['react', '@scope/ui'])
    writeManifest(rootPath, 'packages/ui', '@acme/ui')

    expect(pruneWorkspace(rootPath, ['web-ssr']).removedPackages).toEqual(['packages/ui'])
  })

  it('leaves an optional package it cannot read alone', () => {
    const rootPath = createRoot()
    writeJson(rootPath, 'package.json', { name: 'acme' })
    writeJson(rootPath, 'packages/ui/package.json', { version: '1.0.0' })
    writeFile(rootPath, 'packages/i18n/README.md', '# i18n')

    expect(pruneWorkspace(rootPath, [])).toEqual({ removedApps: [], removedPackages: [] })
    expect(existsSync(join(rootPath, 'packages/ui'))).toBe(true)
    expect(existsSync(join(rootPath, 'packages/i18n'))).toBe(true)
  })

  it('reports the file when a manifest is not valid JSON', () => {
    const rootPath = createWorkspace()
    writeFile(rootPath, 'packages/ui/package.json', '{ nope')

    expect(() => pruneWorkspace(rootPath, BOTH_APPS)).toThrow(
      join(rootPath, 'packages/ui/package.json'),
    )
  })
})

describe('pruneWorkspace missing files', () => {
  it('tolerates missing folders', () => {
    const rootPath = createRoot()
    writeJson(rootPath, 'package.json', { name: 'acme', scripts: { dev: 'pnpm dev' } })
    writeManifest(rootPath, 'apps/web-spa', '@acme/web-spa')

    expect(pruneWorkspace(rootPath, ['web-ssr'])).toEqual({
      removedApps: ['apps/web-spa'],
      removedPackages: [],
    })
    expect(pruneWorkspace(rootPath, [])).toEqual({ removedApps: [], removedPackages: [] })
  })

  it('tolerates a root without a package.json', () => {
    const rootPath = createRoot()
    writeManifest(rootPath, 'apps/web-ssr', '@acme/web-ssr')
    writeManifest(rootPath, 'packages/ui', '@acme/ui')

    expect(pruneWorkspace(rootPath, [])).toEqual({
      removedApps: ['apps/web-ssr'],
      removedPackages: ['packages/ui'],
    })
    expect(existsSync(join(rootPath, 'package.json'))).toBe(false)
  })
})

describe('pruneWorkspace scope', () => {
  it('does not touch docs, configs, workflows, env files or the lockfile', () => {
    const rootPath = createWorkspace()
    const untouched = {
      'pnpm-workspace.yaml': 'packages:\n  - apps/*\n  - packages/*\n',
      'pnpm-lock.yaml': 'lockfileVersion: 9\n# @boilerstone/ui @boilerstone/web-ssr\n',
      'README.md': '# Readme about @boilerstone/ui\n',
      '.env.example': 'API_URL=http://localhost\n',
      'tsconfig.json': '{ "references": [{ "path": "apps/web-ssr" }] }\n',
      '.github/workflows/ci.yml': 'run: pnpm --filter=@boilerstone/openapi-generator build\n',
      '.cursor/rules/frontend.mdc': 'Use @boilerstone/ui\n',
      'apps/documentation/guide.md': 'The ui package is optional\n',
    }
    for (const [path, content] of Object.entries(untouched)) {
      writeFile(rootPath, path, content)
    }

    pruneWorkspace(rootPath, [])

    for (const [path, content] of Object.entries(untouched)) {
      expect(readFileSync(join(rootPath, path), 'utf-8'), path).toBe(content)
    }
  })
})

describe('pruneWorkspace on the real manifests', () => {
  // Copies only the package.json files of the repository, so the real tree is
  // never touched. Fails when the dependency graph changes in a way that
  // changes what `init --apps` keeps.
  function copyRealManifests(): string {
    const rootPath = createRoot()
    cpSync(join(projectRoot, 'package.json'), join(rootPath, 'package.json'))
    for (const parent of ['apps', 'packages']) {
      for (const folder of listFolders(projectRoot, parent)) {
        if (!existsSync(join(projectRoot, parent, folder, 'package.json'))) {
          continue
        }
        mkdirSync(join(rootPath, parent, folder), { recursive: true })
        cpSync(
          join(projectRoot, parent, folder, 'package.json'),
          join(rootPath, parent, folder, 'package.json'),
        )
      }
    }
    return rootPath
  }

  it.each([
    { apps: ['web-spa', 'web-ssr'], removedApps: [], removedPackages: [] },
    { apps: ['web-spa'], removedApps: ['apps/web-ssr'], removedPackages: [] },
    {
      apps: ['web-ssr'],
      removedApps: ['apps/web-spa'],
      removedPackages: ['packages/i18n'],
    },
    {
      apps: [],
      removedApps: ['apps/web-spa', 'apps/web-ssr'],
      removedPackages: ['packages/ui', 'packages/i18n', 'packages/openapi-generator'],
    },
  ] satisfies Array<{ apps: WebApp[]; removedApps: string[]; removedPackages: string[] }>)(
    'keeps $apps',
    ({ apps, removedApps, removedPackages }) => {
      const rootPath = copyRealManifests()

      expect(pruneWorkspace(rootPath, apps)).toEqual({ removedApps, removedPackages })
    },
  )

  it('removes the generate script of the real root package.json with openapi-generator', () => {
    const rootPath = copyRealManifests()

    pruneWorkspace(rootPath, [])

    const scripts = readScripts(rootPath)
    expect(scripts).not.toHaveProperty('generate')
    expect(scripts).toHaveProperty('dev')
  })
})
