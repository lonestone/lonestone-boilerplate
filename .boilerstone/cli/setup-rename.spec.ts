import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { rewriteWorkspaceScope } from '../../cli/setup'

const fixtures: string[] = []

function createFixtureRoot(): string {
  const rootPath = mkdtempSync(join(tmpdir(), 'rock-scope-'))
  fixtures.push(rootPath)
  return rootPath
}

function writeFile(rootPath: string, relativePath: string, content: string): void {
  const filePath = join(rootPath, relativePath)
  mkdirSync(join(filePath, '..'), { recursive: true })
  writeFileSync(filePath, content, 'utf-8')
}

function readFile(rootPath: string, relativePath: string): string {
  return readFileSync(join(rootPath, relativePath), 'utf-8')
}

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true })
  }
})

describe('rewriteWorkspaceScope', () => {
  it('rewrites leftover @boilerstone/ imports, aliases, and docs', () => {
    const rootPath = createFixtureRoot()
    writeFile(
      rootPath,
      'apps/web-ssr/app/root.tsx',
      "import { Button } from '@boilerstone/ui/components/primitives/button'\n",
    )
    writeFile(
      rootPath,
      'packages/ui/src/lib/utils.ts',
      "export { cn } from '@boilerstone/ui/lib/utils'\n",
    )
    writeFile(
      rootPath,
      'packages/ui/tsconfig.json',
      JSON.stringify({ compilerOptions: { paths: { '@boilerstone/ui/*': ['./src/*'] } } }),
    )
    writeFile(
      rootPath,
      'packages/ui/components.json',
      JSON.stringify({ aliases: { utils: '@boilerstone/ui/lib/utils' } }),
    )
    writeFile(
      rootPath,
      'apps/documentation/src/content/docs/references/frontend.mdx',
      'Use components from @boilerstone/ui and types from @boilerstone/openapi-generator.\n',
    )
    writeFile(
      rootPath,
      '.github/workflows/ci.yml',
      'run: pnpm --filter @boilerstone/i18n check-translations\n',
    )

    const actualCount = rewriteWorkspaceScope(rootPath, '@boilerstone', '@acme')

    expect(actualCount).toBe(6)
    expect(readFile(rootPath, 'apps/web-ssr/app/root.tsx')).toContain(
      '@acme/ui/components/primitives/button',
    )
    expect(readFile(rootPath, 'packages/ui/src/lib/utils.ts')).toContain('@acme/ui/lib/utils')
    expect(readFile(rootPath, 'packages/ui/tsconfig.json')).toContain('@acme/ui/*')
    expect(readFile(rootPath, 'packages/ui/components.json')).toContain('@acme/ui/lib/utils')
    expect(readFile(rootPath, 'apps/documentation/src/content/docs/references/frontend.mdx')).toBe(
      'Use components from @acme/ui and types from @acme/openapi-generator.\n',
    )
    expect(readFile(rootPath, '.github/workflows/ci.yml')).toContain('@acme/i18n')
  })

  it('leaves the upgrade CLI, changelog, lockfile, and node_modules unchanged', () => {
    const rootPath = createFixtureRoot()
    writeFile(rootPath, '.boilerstone/package.json', '{"name":"@boilerstone/boilerplate"}\n')
    writeFile(rootPath, 'CHANGELOG.md', '- Unify `@boilerstone/i18n` language keys\n')
    writeFile(rootPath, 'pnpm-lock.yaml', "'@boilerstone/ui':\n")
    writeFile(
      rootPath,
      'node_modules/@boilerstone/ui/index.js',
      "export {} from '@boilerstone/ui'\n",
    )
    writeFile(rootPath, 'cli/setup.ts', "const oldPrefix = '@boilerstone'\n")

    const actualCount = rewriteWorkspaceScope(rootPath, '@boilerstone', '@acme')

    expect(actualCount).toBe(0)
    expect(readFile(rootPath, '.boilerstone/package.json')).toContain('@boilerstone/boilerplate')
    expect(readFile(rootPath, 'CHANGELOG.md')).toContain('@boilerstone/i18n')
    expect(readFile(rootPath, 'pnpm-lock.yaml')).toContain('@boilerstone/ui')
    expect(readFile(rootPath, 'node_modules/@boilerstone/ui/index.js')).toContain('@boilerstone/ui')
    expect(readFile(rootPath, 'cli/setup.ts')).toBe("const oldPrefix = '@boilerstone'\n")
  })

  it('is a no-op when the project keeps the original scope', () => {
    const rootPath = createFixtureRoot()
    writeFile(rootPath, 'apps/web-spa/app/root.tsx', "import '@boilerstone/ui/globals.css'\n")

    const actualCount = rewriteWorkspaceScope(rootPath, '@boilerstone', '@boilerstone')

    expect(actualCount).toBe(0)
    expect(readFile(rootPath, 'apps/web-spa/app/root.tsx')).toContain('@boilerstone/ui/globals.css')
  })
})
