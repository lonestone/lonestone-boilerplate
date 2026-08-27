import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { cleanupBoilerplateFiles, PRODUCER_FILES_TO_REMOVE } from '../../cli/setup'
import { isolatedGitEnv } from '../../cli/utils'
import {
  archiveGitReference,
  extractIntentionReferencePaths,
  finishUpgrade,
  generateReferenceReadme,
  generateSessionPrompt,
  getFetchReleasesCommand,
  prepareUpgrade,
  resolveUpgradePath,
  resolveTargetReference,
} from './boilerplate'
import {
  BOILERPLATE_SCRIPT_COMMAND,
  BOILERPLATE_SCRIPT_NAME,
  compareVersions,
  computeUpgradePath,
  ensureGitignoreLine,
  ensurePackageJsonWiring,
  ensureConsumerBoilerstonePackageJson,
  getFallbackIntentionId,
  getIntentionOrderIssues,
  isUnreleasedIntentionPath,
  parseIntentionMetadataContent,
  parseReferencePathDeclarations,
  parseReferencePaths,
  PRODUCER_ARTIFACTS,
  promoteUnreleasedIntentions,
  readOptionValue,
  resolveTargetVersion,
} from './boilerplate-core'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = resolve(__dirname, '../..')
const cliPath = join(projectRoot, '.boilerstone/cli/boilerplate.ts')

function createIntentionContent(options: {
  id?: string
  domain?: string
  classification?: string
}): string {
  const lines = [
    '---',
    options.id ? `id: ${options.id}` : undefined,
    options.domain ? `domain: ${options.domain}` : undefined,
    options.classification ? `classification: ${options.classification}` : undefined,
    '---',
    '',
    '## Goal',
    '',
    'Test intention.',
  ].filter((line): line is string => line !== undefined)

  return lines.join('\n')
}

function runCli(
  args: string[],
  projectPath?: string,
  env: NodeJS.ProcessEnv = {},
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync('pnpm', ['exec', 'tsx', cliPath, ...args], {
    cwd: projectRoot,
    encoding: 'utf-8',
    env: {
      ...isolatedGitEnv(),
      FORCE_COLOR: '0',
      NO_COLOR: '1',
      ...env,
    },
  })

  if (projectPath) {
    rmSync(projectPath, { recursive: true, force: true })
  }

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

function runGit(cwd: string, args: string[]): void {
  const result = spawnSync('git', args, { cwd, encoding: 'utf-8', env: isolatedGitEnv() })
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
  }
}

function createGitRepo(prefix: string): string {
  const repoDir = mkdtempSync(join(tmpdir(), prefix))
  runGit(repoDir, ['init'])
  runGit(repoDir, ['config', 'user.email', 'test@example.com'])
  runGit(repoDir, ['config', 'user.name', 'Test'])
  runGit(repoDir, ['config', 'commit.gpgsign', 'false'])
  return repoDir
}

function writeProjectFile(projectPath: string, filePath: string, content: string): void {
  const fullPath = join(projectPath, filePath)
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, content)
}

describe('boilerplate core', () => {
  it('orders semantic versions numerically', () => {
    expect(compareVersions('1.10.0', '1.2.0')).toBeGreaterThan(0)
    expect(compareVersions('1.0.0', '1.0')).toBe(0)
    expect(compareVersions('1.0.1', '1.0.2')).toBeLessThan(0)
  })

  it('parses valid, missing, and invalid intention metadata', () => {
    expect(
      parseIntentionMetadataContent(
        createIntentionContent({
          id: 'v1.2.0/api-logger',
          domain: 'api',
          classification: 'migration',
        }),
      ),
    ).toEqual({
      metadata: {
        id: 'v1.2.0/api-logger',
        domain: 'api',
        classification: 'migration',
      },
      issues: [],
    })

    expect(parseIntentionMetadataContent('## Goal\nNo frontmatter.').issues).toEqual([
      'missing frontmatter',
      'missing id',
      'missing domain',
      'missing classification',
    ])

    expect(
      parseIntentionMetadataContent(
        '---\r\nid: v1.0.0/crlf\r\ndomain: api\r\nclassification: migration\r\n---\r\n\r\n## Goal\r\n',
      ).issues,
    ).toEqual([])

    expect(
      parseIntentionMetadataContent(
        createIntentionContent({
          id: 'v1.2.0/bad',
          domain: 'api',
          classification: 'manual-ish',
        }),
      ).issues,
    ).toEqual(['invalid classification: manual-ish', 'missing classification'])
  })

  it('parses a requires: block list into metadata.requires', () => {
    const withRequires = [
      '---',
      'id: v1.0.0/align-shared-dependency-versions',
      'domain: tooling',
      'classification: migration',
      'requires:',
      '  - v1.0.0/align-dependency-baseline',
      '  - v1.0.0/another-dependency',
      '---',
      '',
      '## Goal',
      '',
      'Test intention.',
    ].join('\n')

    expect(parseIntentionMetadataContent(withRequires).metadata.requires).toEqual([
      'v1.0.0/align-dependency-baseline',
      'v1.0.0/another-dependency',
    ])

    expect(
      parseIntentionMetadataContent(
        createIntentionContent({
          id: 'v1.2.0/no-requires',
          domain: 'api',
          classification: 'migration',
        }),
      ).metadata.requires,
    ).toBeUndefined()
  })

  it('rejects malformed option values', () => {
    expect(readOptionValue(['upgrade', 'path', '--to', '1.2.0'], '--to')).toBe('1.2.0')
    expect(readOptionValue(['upgrade', 'path'], '--to')).toBeUndefined()
    expect(() => readOptionValue(['upgrade', 'path', '--to'], '--to')).toThrow(
      '--to requires a value',
    )
    expect(() => readOptionValue(['upgrade', 'path', '--to', '--project'], '--to')).toThrow(
      '--to requires a value',
    )
  })

  it('computes filtered upgrade paths without filesystem or git access', () => {
    const path = computeUpgradePath({
      sourceVersion: '1.0.0',
      targetVersion: '1.2.0',
      trackedDomains: ['api', 'tooling'],
      appliedIntentions: ['v1.2.0/already-applied'],
      skippedIntentions: ['v1.2.0/already-skipped'],
      releases: [
        { version: '1.2.0', tag: 'v1.2.0', date: '2026-01-02', hasMigrations: true },
        { version: '1.0.0', tag: 'v1.0.0', date: '2026-01-01', hasMigrations: false },
        { version: '1.1.0', tag: 'v1.1.0', date: '2026-01-01', hasMigrations: true },
      ],
      intentionFiles: [
        {
          releaseVersion: '1.1.0',
          file: 'api/logger.md',
          relativePath: 'api/logger.md',
          content: createIntentionContent({
            id: 'v1.1.0/api-logger',
            domain: 'api',
            classification: 'migration',
          }),
        },
        {
          releaseVersion: '1.1.0',
          file: 'tooling/manual.md',
          relativePath: 'tooling/manual.md',
          content: createIntentionContent({
            id: 'v1.1.0/manual',
            domain: 'tooling',
            classification: 'breaking-manual',
          }),
        },
        {
          releaseVersion: '1.1.0',
          file: 'api/nested/no-id.md',
          relativePath: 'api/nested/no-id.md',
          content: createIntentionContent({ domain: 'api', classification: 'migration' }),
        },
        {
          releaseVersion: '1.1.0',
          file: 'frontend/domain-override.md',
          relativePath: 'frontend/domain-override.md',
          content: createIntentionContent({
            id: 'v1.1.0/domain-override',
            domain: 'api',
            classification: 'migration',
          }),
        },
        {
          releaseVersion: '1.1.0',
          file: 'frontend/ui.md',
          relativePath: 'frontend/ui.md',
          content: createIntentionContent({
            id: 'v1.1.0/frontend-ui',
            domain: 'frontend',
            classification: 'migration',
          }),
        },
        {
          releaseVersion: '1.2.0',
          file: 'api/already-applied.md',
          relativePath: 'api/already-applied.md',
          content: createIntentionContent({
            id: 'v1.2.0/already-applied',
            domain: 'api',
            classification: 'migration',
          }),
        },
        {
          releaseVersion: '1.2.0',
          file: 'api/already-skipped.md',
          relativePath: 'api/already-skipped.md',
          content: createIntentionContent({
            id: 'v1.2.0/already-skipped',
            domain: 'api',
            classification: 'migration',
          }),
        },
        {
          releaseVersion: '1.2.0',
          file: 'api/missing-metadata.md',
          relativePath: 'api/missing-metadata.md',
          content: '## Goal\nMissing metadata.',
        },
      ],
    })

    expect(path.releases).toEqual(['v1.1.0', 'v1.2.0'])
    expect(path.intentions.map((intention) => intention.id)).toEqual([
      'v1.1.0/api-logger',
      'v1.1.0/api/nested/no-id',
      'v1.1.0/domain-override',
      'v1.1.0/manual',
      'v1.2.0/api/missing-metadata',
    ])
    expect(
      path.intentions.find((intention) => intention.id === 'v1.1.0/domain-override')?.domain,
    ).toBe('api')
    expect(
      path.intentions.find((intention) => intention.id === 'v1.2.0/api/missing-metadata')
        ?.metadataIssues,
    ).toContain('missing frontmatter')
    expect(path.skippedByDomain).toEqual({ frontend: 1 })
    expect(path.alreadyResolvedCount).toBe(2)
    expect(path.classificationCounts.migration).toBe(7)
    expect(path.classificationCounts['breaking-manual']).toBe(1)
  })

  it('keeps nested fallback intention ids deterministic', () => {
    expect(getFallbackIntentionId('1.2.0', 'api/nested/update.md')).toBe('v1.2.0/api/nested/update')
  })

  it('strips the numeric execution-order filename prefix from fallback ids', () => {
    expect(getFallbackIntentionId('1.0.0', '03-align-shared-dependency-versions.md')).toBe(
      'v1.0.0/align-shared-dependency-versions',
    )
  })

  it('treats unreleased/ paths as unpublished staging, not published intentions', () => {
    expect(isUnreleasedIntentionPath('unreleased/add-session-revocation.md')).toBe(true)
    expect(isUnreleasedIntentionPath('unreleased/README.md')).toBe(true)
    expect(isUnreleasedIntentionPath('v1.0.0/00-setup-boilerplate-tracking.md')).toBe(false)
    expect(isUnreleasedIntentionPath('TEMPLATE.md')).toBe(false)
  })

  it('rewrites unreleased ids and assigns NN- prefixes on promote', () => {
    const inputFiles = [
      {
        fileName: 'add-thumbnails.md',
        content: [
          '---',
          'id: unreleased/add-thumbnails',
          'domain: storage',
          'classification: migration',
          'requires:',
          '  - unreleased/add-session-revocation',
          '---',
          '',
          '## Why',
          '',
          'Keep the unreleased/ mention in the body.',
        ].join('\n'),
      },
      {
        fileName: 'add-session-revocation.md',
        content: [
          '---',
          'id: unreleased/add-session-revocation',
          'domain: auth',
          'classification: migration',
          'pr: 142',
          '---',
          '',
          '## Why',
          '',
          'Tombstones rather than deletes.',
        ].join('\n'),
      },
    ]

    const actual = promoteUnreleasedIntentions({
      files: inputFiles,
      version: '1.3.0',
      existingDestFileNames: ['00-already-there.md'],
    })

    expect(actual.map((file) => file.destFileName)).toEqual([
      '01-add-session-revocation.md',
      '02-add-thumbnails.md',
    ])
    expect(actual.map((file) => file.id)).toEqual([
      'v1.3.0/add-session-revocation',
      'v1.3.0/add-thumbnails',
    ])
    expect(actual[0].content).toContain('id: v1.3.0/add-session-revocation')
    expect(actual[0].content).toContain('pr: 142')
    expect(actual[1].content).toContain('id: v1.3.0/add-thumbnails')
    expect(actual[1].content).toContain('  - v1.3.0/add-session-revocation')
    expect(actual[1].content).toContain('Keep the unreleased/ mention in the body.')
  })

  it('validates the requires graph against execution order', () => {
    expect(
      getIntentionOrderIssues([
        {
          id: 'v1.0.0/align-dependency-baseline',
          file: '02-align-dependency-baseline.md',
          requires: [],
        },
        {
          id: 'v1.0.0/align-shared-dependency-versions',
          file: '03-align-shared-dependency-versions.md',
          requires: ['v1.0.0/align-dependency-baseline'],
        },
      ]),
    ).toEqual([])

    expect(
      getIntentionOrderIssues([
        {
          id: 'v1.0.0/align-shared-dependency-versions',
          file: '03-align-shared-dependency-versions.md',
          requires: ['v1.0.0/does-not-exist'],
        },
      ]),
    ).toEqual([
      {
        file: '03-align-shared-dependency-versions.md',
        issue: 'unknown requires: v1.0.0/does-not-exist',
      },
    ])

    const laterDependency = getIntentionOrderIssues([
      {
        id: 'v1.0.0/align-shared-dependency-versions',
        file: '03-align-shared-dependency-versions.md',
        requires: ['v1.0.0/align-dependency-baseline'],
      },
      {
        id: 'v1.0.0/align-dependency-baseline',
        file: '04-align-dependency-baseline.md',
        requires: [],
      },
    ])
    expect(laterDependency).toHaveLength(1)
    expect(laterDependency[0].issue).toContain('must come earlier')
  })

  it('resolves the "latest" keyword to the newest release', () => {
    const releases = [
      { version: '1.0.0', tag: 'v1.0.0', date: '', hasMigrations: false },
      { version: '1.10.0', tag: 'v1.10.0', date: '', hasMigrations: true },
      { version: '1.2.0', tag: 'v1.2.0', date: '', hasMigrations: true },
    ]
    expect(resolveTargetVersion('latest', releases)).toBe('1.10.0')
    expect(resolveTargetVersion('1.2.0', releases)).toBe('1.2.0')
    expect(() => resolveTargetVersion('latest', [])).toThrow('Cannot resolve "latest"')
  })

  it('wires a package.json with the boilerplate script and tsx, idempotently', () => {
    const first = ensurePackageJsonWiring({ name: 'app', scripts: { dev: 'vite' } }, '^4.21.0')
    expect(first.pkg.scripts?.[BOILERPLATE_SCRIPT_NAME]).toBe(BOILERPLATE_SCRIPT_COMMAND)
    expect(first.pkg.scripts?.dev).toBe('vite')
    expect(first.pkg.devDependencies?.tsx).toBe('^4.21.0')
    expect(first.changes).toHaveLength(2)

    const second = ensurePackageJsonWiring(first.pkg, '^4.21.0')
    expect(second.changes).toEqual([])
  })

  it('never overwrites an existing boilerplate script or tsx dependency', () => {
    const result = ensurePackageJsonWiring(
      {
        scripts: { boilerplate: 'custom' },
        dependencies: { tsx: '^3.0.0' },
      },
      '^4.21.0',
    )

    expect(result.pkg.scripts?.boilerplate).toBe('custom')
    expect(result.pkg.devDependencies?.tsx).toBeUndefined()
    expect(result.changes).toEqual([])
  })

  it('appends a gitignore line only when missing and stays newline-safe', () => {
    expect(ensureGitignoreLine('node_modules', '.boilerstone/upgrade/')).toEqual({
      content: 'node_modules\n.boilerstone/upgrade/\n',
      changed: true,
    })
    expect(
      ensureGitignoreLine('node_modules\n.boilerstone/upgrade/\n', '.boilerstone/upgrade/'),
    ).toEqual({
      content: 'node_modules\n.boilerstone/upgrade/\n',
      changed: false,
    })
    expect(ensureGitignoreLine('', '.boilerstone/upgrade/')).toEqual({
      content: '.boilerstone/upgrade/\n',
      changed: true,
    })
  })

  it('drops the producer-only artifacts in consumer mode', () => {
    expect(PRODUCER_ARTIFACTS).toContain('migration-intentions')
    expect(PRODUCER_ARTIFACTS).toContain('boilerplate.example.json')
    expect(PRODUCER_ARTIFACTS).toContain('cli/boilerplate-core.spec.ts')
    expect(PRODUCER_ARTIFACTS).toContain('vitest.config.ts')
    expect(PRODUCER_ARTIFACTS).toContain('docs/release-maintainer-runbook.md')
  })

  it('strips Vitest tooling from the vendored boilerstone package.json', () => {
    const first = ensureConsumerBoilerstonePackageJson({
      name: '@boilerstone/boilerplate',
      scripts: { test: 'vitest run', typecheck: 'tsc --noEmit' },
      devDependencies: { vitest: '^4.1.5' },
    })
    expect(first.pkg.scripts).toEqual({ typecheck: 'tsc --noEmit' })
    expect(first.pkg.devDependencies).toEqual({})
    expect(first.changes).toEqual(['removed "test" script', 'removed "vitest" devDependency'])

    const second = ensureConsumerBoilerstonePackageJson(first.pkg)
    expect(second.changes).toEqual([])
  })

  it('keeps the setup cleanup list in sync with PRODUCER_ARTIFACTS', () => {
    // cli/setup.ts must stay importable after `rm -rf .boilerstone`, so it
    // mirrors the list instead of importing it — this test is the sync lock.
    for (const artifact of PRODUCER_ARTIFACTS) {
      expect(PRODUCER_FILES_TO_REMOVE).toContain(`.boilerstone/${artifact}`)
    }
  })

  it('keeps the vendored CLI utils in sync with the root setup utils', () => {
    const rootUtils = readFileSync(join(projectRoot, 'cli/utils.ts'), 'utf-8')
    const vendoredUtils = readFileSync(
      join(projectRoot, '.boilerstone/cli/utils.ts'),
      'utf-8',
    ).replace(/\/\/ Vendored copy[\s\S]*?\/\/ the root cli\/utils\.ts\.\n\n/, '')

    expect(vendoredUtils).toBe(rootUtils)
  })

  it('matches generated intention ids against the state schema pattern', () => {
    const schema = JSON.parse(
      readFileSync(join(projectRoot, '.boilerstone/boilerplate.schema.json'), 'utf-8'),
    )
    const pattern = new RegExp(
      schema.properties.intentions.properties.applied.items.properties.id.pattern,
    )

    expect(pattern.test('v1.0.0/setup-boilerplate-tracking')).toBe(true)
    // Nested fallback ids must satisfy the schema too (regression: generator vs validator)
    expect(pattern.test(getFallbackIntentionId('1.1.0', 'api/nested/no-id.md'))).toBe(true)
    expect(pattern.test('v1.0.0')).toBe(false)
    expect(pattern.test('v1.0.0/Bad_Slug')).toBe(false)
  })
})

describe('parseReferencePaths', () => {
  it('parses explicit copy and adapt policies for human and AI executors', () => {
    const content = [
      '## Reference Paths',
      '',
      '- `package.json` — adapt',
      '- `.oxlintrc.json` — copy',
    ].join('\n')

    expect(parseReferencePathDeclarations(content)).toEqual({
      references: [
        { path: '.oxlintrc.json', mode: 'copy' },
        { path: 'package.json', mode: 'adapt' },
      ],
      issues: [],
    })
  })

  it('defaults legacy reference paths to adapt and reports the missing policy', () => {
    const content = ['## Reference Paths', '', '- `package.json`'].join('\n')

    expect(parseReferencePathDeclarations(content)).toEqual({
      references: [{ path: 'package.json', mode: 'adapt' }],
      issues: ['reference path package.json must declare copy or adapt'],
    })
  })

  it('extracts backticked paths from the Reference Paths section only', () => {
    const content = [
      '# Intention',
      '',
      '## Reference Paths',
      '',
      '- `apps/api/package.json`',
      '- `apps/api/src/modules/db/`',
      "- `apps/api/mikro-orm.config.ts` or the project's equivalent MikroORM config",
      '- `.boilerstone/boilerplate.schema.json`',
      '- see `https://example.com/doc`',
      '',
      '## Validation',
      '',
      '- `pnpm test` passes.',
    ].join('\n')

    expect(parseReferencePaths(content)).toEqual([
      'apps/api/mikro-orm.config.ts',
      'apps/api/package.json',
      'apps/api/src/modules/db',
    ])
  })

  it('returns an empty list when the section is missing', () => {
    expect(parseReferencePaths('# Intention\n\n## Goal\n\nNo references here.')).toEqual([])
  })
})

describe('extractIntentionReferencePaths', () => {
  it('stages declared paths that exist at the target tag and skips the rest', () => {
    const repoDir = createGitRepo('boilerplate-refpaths-repo-')
    const destDir = mkdtempSync(join(tmpdir(), 'boilerplate-refpaths-dest-'))

    try {
      mkdirSync(join(repoDir, 'apps', 'api', 'src'), { recursive: true })
      writeFileSync(join(repoDir, 'apps', 'api', 'package.json'), '{"name":"api"}\n')
      writeFileSync(join(repoDir, 'apps', 'api', 'src', 'main.ts'), 'export {}\n')
      writeFileSync(join(repoDir, 'unrelated.txt'), 'not referenced\n')
      runGit(repoDir, ['add', '-A'])
      runGit(repoDir, ['commit', '-m', 'init'])
      runGit(repoDir, ['tag', 'v9.9.9'])

      const intention = {
        content: [
          '## Reference Paths',
          '',
          '- `apps/api/package.json`',
          '- `apps/api/src/`',
          '- `apps/api/missing-file.ts`',
        ].join('\n'),
      }

      const staged = extractIntentionReferencePaths([intention], 'v9.9.9', destDir, repoDir)

      expect(staged).toEqual(['apps/api/package.json', 'apps/api/src'])
      expect(existsSync(join(destDir, 'apps', 'api', 'package.json'))).toBe(true)
      expect(existsSync(join(destDir, 'apps', 'api', 'src', 'main.ts'))).toBe(true)
      expect(existsSync(join(destDir, 'unrelated.txt'))).toBe(false)
      expect(existsSync(join(destDir, '.reference.tar'))).toBe(false)
    } finally {
      rmSync(repoDir, { recursive: true, force: true })
      rmSync(destDir, { recursive: true, force: true })
    }
  })
})

describe('archiveGitReference', () => {
  it('extracts only .boilerstone/ and survives archives larger than the default exec buffer', () => {
    const repoDir = createGitRepo('boilerplate-archive-repo-')
    const destDir = mkdtempSync(join(tmpdir(), 'boilerplate-archive-dest-'))

    try {
      mkdirSync(join(repoDir, '.boilerstone'), { recursive: true })
      writeFileSync(join(repoDir, '.boilerstone', 'big.bin'), Buffer.alloc(2 * 1024 * 1024, 1))
      writeFileSync(join(repoDir, 'outside.txt'), 'not part of the reference')
      runGit(repoDir, ['add', '-A'])
      runGit(repoDir, ['commit', '-m', 'init'])
      runGit(repoDir, ['tag', 'v9.9.9'])

      archiveGitReference('v9.9.9', destDir, repoDir)

      expect(statSync(join(destDir, '.boilerstone', 'big.bin')).size).toBe(2 * 1024 * 1024)
      expect(existsSync(join(destDir, 'outside.txt'))).toBe(false)
      expect(existsSync(join(destDir, '.reference.tar'))).toBe(false)
    } finally {
      rmSync(repoDir, { recursive: true, force: true })
      rmSync(destDir, { recursive: true, force: true })
    }
  })
})

describe('generated shell commands', () => {
  it.each([
    ['/tmp/producer checkout', "'/tmp/producer checkout'"],
    ["/tmp/producer's checkout", "'/tmp/producer'\"'\"'s checkout'"],
    ['/tmp/producer;touch-pwned', "'/tmp/producer;touch-pwned'"],
    ['/tmp/producer$(touch-pwned)', "'/tmp/producer$(touch-pwned)'"],
    ['/tmp/producer`touch-pwned`', "'/tmp/producer`touch-pwned`'"],
  ])('keeps a target cwd containing %s in one safely quoted command line', (targetCwd, quoted) => {
    const readme = generateReferenceReadme({
      declarations: [],
      sourceRef: 'v1.0.0',
      targetRef: 'v1.1.0',
      targetCwd,
      targetLabel: 'v1.1.0',
      isTargetDraft: false,
      stagedSourcePaths: [],
      stagedTargetPaths: [],
    })
    const commandBlock = readme.match(/```bash\n(?<commands>[\s\S]*?)\n```/)?.groups?.commands

    expect(commandBlock?.split('\n')).toEqual([
      `git -C ${quoted} show v1.1.0:<path>`,
      `git -C ${quoted} archive v1.1.0 -- <path> | tar -x -C .boilerstone/upgrade/reference/target/`,
    ])
  })

  it.each([
    ['https://example.com/boilerplate.git', "'https://example.com/boilerplate.git'"],
    ['/tmp/local boilerplate.git', "'/tmp/local boilerplate.git'"],
    ["/tmp/local'boilerplate.git", "'/tmp/local'\"'\"'boilerplate.git'"],
    ['/tmp/local;touch-pwned', "'/tmp/local;touch-pwned'"],
    ['/tmp/local$(touch-pwned)', "'/tmp/local$(touch-pwned)'"],
    ['/tmp/local`touch-pwned`', "'/tmp/local`touch-pwned`'"],
  ])('quotes a Git remote containing %s in fetch and session commands', (remote, quoted) => {
    const state = {
      schemaVersion: 1,
      source: {
        repository: 'lonestone/lonestone-boilerplate',
        remote,
        currentVersion: '1.0.0',
      },
      trackedDomains: [],
      intentions: { applied: [], skipped: [] },
    }
    const session = generateSessionPrompt(
      {
        sourceVersion: '1.0.0',
        targetVersion: '1.1.0',
        releases: ['v1.1.0'],
        intentions: [],
        sourceTag: 'v1.0.0',
        targetTag: 'v1.1.0',
        classificationCounts: {
          'no-migration': 0,
          informational: 0,
          migration: 0,
          'breaking-manual': 0,
        },
        skippedByDomain: {},
        alreadyResolvedCount: 0,
      },
      state,
      {
        declarations: [],
        sourceRef: 'v1.0.0',
        targetRef: 'v1.1.0',
        targetCwd: '/tmp/producer',
        targetLabel: 'v1.1.0',
        isTargetDraft: false,
        stagedSourcePaths: [],
        stagedTargetPaths: [],
      },
    )

    expect(getFetchReleasesCommand(remote)).toBe(
      `git fetch --no-tags ${quoted} "+refs/tags/v*:refs/boilerstone/v*"`,
    )
    expect(session).toContain(
      `git clone --depth 1 --branch 'v1.1.0' ${quoted} '.boilerstone/upgrade/reference/full'`,
    )
    expect(session.match(/touch-pwned/g)?.length ?? 0).toBe(remote.includes('touch-pwned') ? 1 : 0)
  })

  it.each(['line\nbreak', 'line\rbreak', 'fence```break', 'control\u0001break'])(
    'rejects command arguments that can break generated Markdown: %s',
    (unsafeValue) => {
      expect(() => getFetchReleasesCommand(unsafeValue)).toThrow(
        'Cannot render unsafe shell argument',
      )
    },
  )
})

describe('resolveUpgradePath', () => {
  it('resolves the latest local publication from the tracked project context', () => {
    const projectPath = createGitRepo('boilerplate-resolve-latest-')

    try {
      writeProjectFile(projectPath, '.boilerstone/README.md', '# boilerstone\n')
      writeProjectFile(
        projectPath,
        '.boilerstone/boilerplate.json',
        `${JSON.stringify(
          {
            schemaVersion: 1,
            source: {
              repository: 'lonestone/lonestone-boilerplate',
              remote: '/definitely/missing/boilerstone.git',
              currentVersion: '0.0.0',
            },
            trackedDomains: ['tooling'],
            intentions: {
              applied: [{ id: '1.0.0/already-applied', appliedAt: '2026-07-14' }],
              skipped: [{ id: 'v1.0.0/already-skipped', reason: 'Already handled locally' }],
            },
          },
          null,
          2,
        )}\n`,
      )
      writeProjectFile(
        projectPath,
        '.boilerstone/migration-intentions/v1.0.0/README.md',
        '# v1.0.0\n',
      )
      for (const id of ['already-applied', 'already-skipped', 'pending']) {
        writeProjectFile(
          projectPath,
          `.boilerstone/migration-intentions/v1.0.0/${id}.md`,
          createIntentionContent({
            id: `v1.0.0/${id}`,
            domain: 'tooling',
            classification: 'migration',
          }),
        )
      }
      runGit(projectPath, ['add', '-A'])
      runGit(projectPath, ['commit', '-m', 'boilerstone release'])
      runGit(projectPath, ['tag', 'v1.0.0'])

      const result = resolveUpgradePath({
        projectPath,
        producerPath: projectPath,
        targetVersion: 'latest',
        publicationPolicy: 'local-only',
      })
      const refreshedResult = resolveUpgradePath({
        projectPath,
        producerPath: projectPath,
        targetVersion: 'latest',
        publicationPolicy: 'refresh-if-needed',
      })

      expect(result.path.intentions.map((intention) => intention.id)).toEqual(['v1.0.0/pending'])
      expect(result.path.alreadyResolvedCount).toBe(2)
      expect(result.branchName).toBe('upgrade/v0.0.0-to-v1.0.0')
      expect(result.targetRelease.version).toBe('1.0.0')
      expect(result.targetReference.provenance).toBe('consumer-ref')
      expect(result.state?.trackedDomains).toEqual(['tooling'])
      expect(result.state?.intentions.applied[0]?.id).toBe('v1.0.0/already-applied')
      expect(result.warnings).toEqual([])
      expect(refreshedResult.path).toEqual(result.path)
      expect(refreshedResult.warnings[0]).toContain(
        'Failed to fetch releases from /definitely/missing/boilerstone.git',
      )
      expect(existsSync(join(projectPath, '.boilerstone', 'upgrade'))).toBe(false)
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
    }
  })

  it('rejects an unknown explicit target instead of computing an empty path', () => {
    const projectPath = createGitRepo('boilerplate-resolve-unknown-')

    try {
      writeProjectFile(projectPath, '.boilerstone/README.md', '# boilerstone\n')
      writeProjectFile(
        projectPath,
        '.boilerstone/migration-intentions/v1.0.0/README.md',
        '# v1.0.0\n',
      )
      runGit(projectPath, ['add', '-A'])
      runGit(projectPath, ['commit', '-m', 'boilerstone release'])
      runGit(projectPath, ['tag', 'v1.0.0'])

      expect(() =>
        resolveUpgradePath({
          projectPath,
          sourceVersion: '0.0.0',
          targetVersion: '9.9.9',
          publicationPolicy: 'local-only',
        }),
      ).toThrow('Unknown boilerplate target version: 9.9.9')
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
    }
  })

  it('uses a source override without dropping tracked domains or resolved intentions', () => {
    const projectPath = createGitRepo('boilerplate-resolve-override-')

    try {
      writeProjectFile(projectPath, '.boilerstone/README.md', '# boilerstone\n')
      writeProjectFile(
        projectPath,
        '.boilerstone/boilerplate.json',
        `${JSON.stringify(
          {
            schemaVersion: 1,
            source: { repository: 'lonestone/lonestone-boilerplate', currentVersion: '1.0.0' },
            trackedDomains: ['api'],
            intentions: {
              applied: [{ id: 'v1.0.0/applied', appliedAt: '2026-07-14' }],
              skipped: [{ id: 'v1.0.0/skipped', reason: 'Already handled locally' }],
            },
          },
          null,
          2,
        )}\n`,
      )
      writeProjectFile(
        projectPath,
        '.boilerstone/migration-intentions/v1.0.0/README.md',
        '# v1.0.0\n',
      )
      for (const id of ['applied', 'skipped', 'pending']) {
        writeProjectFile(
          projectPath,
          `.boilerstone/migration-intentions/v1.0.0/${id}.md`,
          createIntentionContent({
            id: `v1.0.0/${id}`,
            domain: 'api',
            classification: 'migration',
          }),
        )
      }
      writeProjectFile(
        projectPath,
        '.boilerstone/migration-intentions/v1.0.0/frontend.md',
        createIntentionContent({
          id: 'v1.0.0/frontend',
          domain: 'frontend',
          classification: 'migration',
        }),
      )
      runGit(projectPath, ['add', '-A'])
      runGit(projectPath, ['commit', '-m', 'boilerstone release'])
      runGit(projectPath, ['tag', 'v1.0.0'])

      const result = resolveUpgradePath({
        projectPath,
        sourceVersion: '0.0.0',
        targetVersion: '1.0.0',
        publicationPolicy: 'local-only',
      })

      expect(result.path.sourceVersion).toBe('0.0.0')
      expect(result.path.intentions.map((intention) => intention.id)).toEqual(['v1.0.0/pending'])
      expect(result.path.alreadyResolvedCount).toBe(2)
      expect(result.path.skippedByDomain).toEqual({ frontend: 1 })
      expect(result.state?.source.currentVersion).toBe('1.0.0')
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
    }
  })

  it('propagates refresh failures when publication refresh is required', () => {
    const projectPath = createGitRepo('boilerplate-resolve-required-refresh-')

    try {
      writeProjectFile(projectPath, '.boilerstone/README.md', '# boilerstone\n')
      writeProjectFile(
        projectPath,
        '.boilerstone/boilerplate.json',
        `${JSON.stringify(
          {
            schemaVersion: 1,
            source: {
              repository: 'lonestone/lonestone-boilerplate',
              remote: '/definitely/missing/boilerstone.git',
              currentVersion: '0.0.0',
            },
            trackedDomains: [],
            intentions: { applied: [], skipped: [] },
          },
          null,
          2,
        )}\n`,
      )
      runGit(projectPath, ['add', '-A'])
      runGit(projectPath, ['commit', '-m', 'consumer project'])

      expect(() =>
        resolveUpgradePath({
          projectPath,
          targetVersion: 'latest',
          publicationPolicy: 'refresh-required',
        }),
      ).toThrow('Failed to fetch releases from /definitely/missing/boilerstone.git')
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
    }
  })

  it('rejects an explicit non-SemVer source before attempting a required refresh', () => {
    const projectPath = createGitRepo('boilerplate-resolve-invalid-source-')

    try {
      writeProjectFile(
        projectPath,
        '.boilerstone/boilerplate.json',
        `${JSON.stringify({
          schemaVersion: 1,
          source: {
            repository: 'lonestone/lonestone-boilerplate',
            remote: '/sentinel/must-not-be-fetched',
            currentVersion: '1.0.0',
          },
          trackedDomains: [],
          intentions: { applied: [], skipped: [] },
        })}\n`,
      )
      runGit(projectPath, ['add', '-A'])
      runGit(projectPath, ['commit', '-m', 'consumer project'])

      expect(() =>
        resolveUpgradePath({
          projectPath,
          sourceVersion: 'not-semver',
          targetVersion: 'latest',
          publicationPolicy: 'refresh-required',
        }),
      ).toThrow('Invalid source version: not-semver')
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
    }
  })

  it('rejects a downgrade in resolution and finish without changing tracking state', () => {
    const projectPath = createGitRepo('boilerplate-resolve-downgrade-')
    const statePath = join(projectPath, '.boilerstone/boilerplate.json')

    try {
      writeProjectFile(projectPath, '.boilerstone/README.md', '# boilerstone\n')
      writeProjectFile(
        projectPath,
        '.boilerstone/migration-intentions/v1.0.0/README.md',
        '# v1.0.0\n',
      )
      writeProjectFile(
        projectPath,
        '.boilerstone/boilerplate.json',
        `${JSON.stringify({
          schemaVersion: 1,
          source: { repository: 'lonestone/lonestone-boilerplate', currentVersion: '2.0.0' },
          trackedDomains: [],
          intentions: { applied: [], skipped: [] },
        })}\n`,
      )
      runGit(projectPath, ['add', '-A'])
      runGit(projectPath, ['commit', '-m', 'consumer project'])
      runGit(projectPath, ['tag', 'v1.0.0'])
      const initialState = readFileSync(statePath, 'utf-8')

      expect(() =>
        resolveUpgradePath({
          projectPath,
          targetVersion: '1.0.0',
          publicationPolicy: 'local-only',
        }),
      ).toThrow('Cannot downgrade from 2.0.0 to 1.0.0')
      expect(() => finishUpgrade({ projectPath, targetVersion: '1.0.0' })).toThrow(
        'Cannot downgrade from 2.0.0 to 1.0.0',
      )
      expect(readFileSync(statePath, 'utf-8')).toBe(initialState)
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
    }
  })

  it('does not use an application tag that collides with a producer release', () => {
    const projectPath = createGitRepo('boilerplate-resolve-app-tag-')

    try {
      writeProjectFile(projectPath, '.boilerstone/README.md', '# consumer files only\n')
      runGit(projectPath, ['add', '-A'])
      runGit(projectPath, ['commit', '-m', 'application release'])
      runGit(projectPath, ['tag', 'v1.0.0'])

      const result = resolveUpgradePath({
        projectPath,
        sourceVersion: '0.0.0',
        targetVersion: '1.0.0',
        publicationPolicy: 'local-only',
      })

      expect(result.targetReference.provenance).toBe('producer-ref')
      expect(result.targetReference.label).toBe('v1.0.0')
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
    }
  })

  it('lets finish reuse the local resolution and refuses unresolved intentions', () => {
    const projectPath = createGitRepo('boilerplate-resolve-finish-')
    const statePath = join(projectPath, '.boilerstone/boilerplate.json')
    const intentionId = 'v1.0.0/finish-me'

    try {
      writeProjectFile(projectPath, '.boilerstone/README.md', '# boilerstone\n')
      writeProjectFile(
        projectPath,
        '.boilerstone/migration-intentions/v1.0.0/README.md',
        '# v1.0.0\n',
      )
      writeProjectFile(
        projectPath,
        '.boilerstone/migration-intentions/v1.0.0/finish-me.md',
        createIntentionContent({
          id: intentionId,
          domain: 'tooling',
          classification: 'migration',
        }),
      )
      const state = {
        schemaVersion: 1,
        source: { repository: 'lonestone/lonestone-boilerplate', currentVersion: '0.0.0' },
        trackedDomains: [],
        intentions: { applied: [] as Array<{ id: string; appliedAt: string }>, skipped: [] },
      }
      writeProjectFile(projectPath, '.boilerstone/boilerplate.json', `${JSON.stringify(state)}\n`)
      runGit(projectPath, ['add', '-A'])
      runGit(projectPath, ['commit', '-m', 'boilerstone release'])
      runGit(projectPath, ['tag', 'v1.0.0'])

      expect(() => finishUpgrade({ projectPath, targetVersion: '1.0.0' })).toThrow(
        `  - ${intentionId}`,
      )
      expect(JSON.parse(readFileSync(statePath, 'utf-8')).source.currentVersion).toBe('0.0.0')

      state.intentions.applied.push({ id: intentionId, appliedAt: '2026-07-15' })
      writeFileSync(statePath, `${JSON.stringify(state)}\n`)
      const expectedResolution = resolveUpgradePath({
        projectPath,
        targetVersion: '1.0.0',
        publicationPolicy: 'local-only',
      })

      const actualResolution = finishUpgrade({ projectPath, targetVersion: '1.0.0' })

      expect(actualResolution.path).toEqual(expectedResolution.path)
      expect(actualResolution.targetRelease).toEqual(expectedResolution.targetRelease)
      expect(actualResolution.targetReference).toEqual(expectedResolution.targetReference)
      expect(JSON.parse(readFileSync(statePath, 'utf-8')).source.currentVersion).toBe('1.0.0')
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
    }
  })
})

describe('resolveTargetReference', () => {
  it('uses the producer HEAD explicitly for an untagged local draft', () => {
    const consumerPath = createGitRepo('boilerplate-draft-consumer-')
    const producerPath = createGitRepo('boilerplate-draft-producer-')

    try {
      writeProjectFile(
        producerPath,
        '.boilerstone/migration-intentions/v9.9.9/README.md',
        '# draft\n',
      )
      runGit(producerPath, ['add', '-A'])
      runGit(producerPath, ['commit', '-m', 'draft release'])

      expect(
        resolveTargetReference(
          {
            version: '9.9.9',
            tag: 'v9.9.9',
            date: 'local-draft',
            hasMigrations: true,
          },
          consumerPath,
          producerPath,
        ),
      ).toEqual({
        ref: 'HEAD',
        cwd: producerPath,
        label: 'HEAD (producer draft for v9.9.9)',
        isDraft: true,
        provenance: 'producer-draft',
      })
    } finally {
      rmSync(consumerPath, { recursive: true, force: true })
      rmSync(producerPath, { recursive: true, force: true })
    }
  })
})

describe('boilerplate CLI smoke', () => {
  it('prints help without modifying the repository', () => {
    const result = runCli([])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Boilerplate CLI')
  })

  it('lists versions without writing project state', () => {
    const result = runCli(['versions', 'list'])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Available Boilerplate Versions')
  })

  it('reports missing state with init guidance and a failing readiness summary', () => {
    const projectPath = mkdtempSync(join(tmpdir(), 'boilerplate-status-'))
    const result = runCli(['upgrade', 'status', '--project', projectPath], projectPath)

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('No boilerplate.json found')
    expect(result.stdout).toContain('boilerplate upgrade init')
    expect(result.stdout).toContain('Readiness:')
  })

  it('fails clearly when an option value is missing', () => {
    const result = runCli(['upgrade', 'path', '--to'])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('--to requires a value')
  })

  it('emits machine-readable status with readiness checks with --json', () => {
    const projectPath = mkdtempSync(join(tmpdir(), 'boilerplate-json-status-'))
    const result = runCli(['upgrade', 'status', '--project', projectPath, '--json'], projectPath)

    expect(result.status).toBe(1)
    const payload = JSON.parse(result.stdout)
    expect(payload.initialized).toBe(false)
    expect(payload.summary.failed).toBeGreaterThan(0)
    expect(
      payload.checks.some((check: { name: string }) => check.name === 'boilerplate.json'),
    ).toBe(true)
  })

  it('initializes canonical tracking state through the consumer module', () => {
    const projectPath = mkdtempSync(join(tmpdir(), 'boilerplate-init-state-'))

    try {
      const result = runCli(['upgrade', 'init', '--project', projectPath], undefined, {
        BOILERPLATE_SOURCE_VERSION: 'v1.2.3',
        BOILERPLATE_SOURCE_COMMIT: 'abcdef1234567890',
      })

      expect(result.status).toBe(0)
      const state = JSON.parse(
        readFileSync(join(projectPath, '.boilerstone', 'boilerplate.json'), 'utf-8'),
      )
      expect(state.source.currentVersion).toBe('1.2.3')
      expect(state.source.commit).toBe('abcdef1234567890')
      expect(state.trackedDomains).toEqual([
        'tooling',
        'api',
        'frontend',
        'ci',
        'docker-env',
        'monitoring',
        'email',
        'auth',
        'storage',
        'ai',
      ])
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
    }
  })

  it('defaults the source version to 0.0.0 when nothing is detectable', () => {
    const projectPath = mkdtempSync(join(tmpdir(), 'boilerplate-init-default-'))

    try {
      // No env, no git history, no boilerplate.json: a project that predates
      // the upgrade system. Non-interactive stdin must take the default.
      const result = runCli(['upgrade', 'init', '--project', projectPath])

      expect(result.status).toBe(0)
      const state = JSON.parse(
        readFileSync(join(projectPath, '.boilerstone', 'boilerplate.json'), 'utf-8'),
      )
      expect(state.source.currentVersion).toBe('0.0.0')
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
    }
  })

  it('emits machine-readable upgrade paths with --json', () => {
    const result = runCli(['upgrade', 'path', '--from', '0.9.0', '--to', '1.0.0', '--json'])

    expect(result.status).toBe(0)
    const payload = JSON.parse(result.stdout)
    expect(payload.sourceVersion).toBe('0.9.0')
    expect(payload.targetVersion).toBe('1.0.0')
    expect(payload.branchName).toBe('upgrade/v0.9.0-to-v1.0.0')
    expect(Array.isArray(payload.intentions)).toBe(true)
  })

  it('validates checked-in migration intentions', () => {
    const result = runCli(['intentions', 'lint', '--json'])

    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual({ ok: true, issues: [] })
  })

  it('refuses a premature finish, then finishes once every intention is recorded', () => {
    const projectPath = createGitRepo('boilerplate-record-')

    try {
      writeProjectFile(projectPath, '.boilerstone/README.md', '# boilerstone\n')
      writeProjectFile(
        projectPath,
        '.boilerstone/boilerplate.json',
        `${JSON.stringify(
          {
            schemaVersion: 1,
            source: { repository: 'lonestone/lonestone-boilerplate', currentVersion: '1.0.0' },
            trackedDomains: [],
            intentions: { applied: [], skipped: [] },
          },
          null,
          2,
        )}\n`,
      )
      writeProjectFile(
        projectPath,
        '.boilerstone/migration-intentions/v1.1.0/README.md',
        '# v1.1.0\n',
      )
      writeProjectFile(
        projectPath,
        '.boilerstone/migration-intentions/v1.1.0/00-example-intention.md',
        createIntentionContent({
          id: 'v1.1.0/example-intention',
          domain: 'tooling',
          classification: 'migration',
        }),
      )
      runGit(projectPath, ['add', '-A'])
      runGit(projectPath, ['commit', '-m', 'init'])
      runGit(projectPath, ['tag', 'v1.1.0'])

      // The v1.0.0 pilot incident: finish before resolving the range must fail
      const premature = runCli(['upgrade', 'finish', '--project', projectPath, '--to', '1.1.0'])
      expect(premature.status).toBe(1)
      expect(premature.stderr).toContain('Refusing to finish')
      expect(premature.stderr).toContain('v1.1.0/example-intention')

      const record = runCli([
        'upgrade',
        'record',
        '--project',
        projectPath,
        '--id',
        'v1.1.0/example-intention',
        '--applied',
      ])
      const finish = runCli(['upgrade', 'finish', '--project', projectPath, '--to', '1.1.0'])

      expect(record.status).toBe(0)
      expect(finish.status).toBe(0)
      const state = JSON.parse(
        readFileSync(join(projectPath, '.boilerstone/boilerplate.json'), 'utf-8'),
      )
      expect(state.intentions.applied).toEqual([
        { id: 'v1.1.0/example-intention', appliedAt: expect.any(String) },
      ])
      expect(state.source.currentVersion).toBe('1.1.0')
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
    }
  })

  it('records state successfully with a recoverable warning when session sync fails', () => {
    const projectPath = mkdtempSync(join(tmpdir(), 'boilerplate-record-session-warning-'))

    try {
      writeProjectFile(
        projectPath,
        '.boilerstone/boilerplate.json',
        `${JSON.stringify({
          schemaVersion: 1,
          source: { repository: 'lonestone/lonestone-boilerplate', currentVersion: '1.0.0' },
          trackedDomains: [],
          intentions: { applied: [], skipped: [] },
        })}\n`,
      )
      mkdirSync(join(projectPath, '.boilerstone/upgrade/upgrade-session.md'), { recursive: true })

      const result = runCli([
        'upgrade',
        'record',
        '--project',
        projectPath,
        '--id',
        '1.1.0/example',
        '--applied',
      ])

      expect(result.status).toBe(0)
      expect(result.stdout).toContain('Recorded applied: v1.1.0/example')
      expect(result.stderr).toContain('state was saved')
      expect(result.stderr).toContain('upgrade-session.md could not be synchronized')
      expect(
        JSON.parse(readFileSync(join(projectPath, '.boilerstone/boilerplate.json'), 'utf-8'))
          .intentions.applied,
      ).toEqual([{ id: 'v1.1.0/example', appliedAt: expect.any(String) }])
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
    }
  })

  it('refuses to finish when the target release is not available locally', () => {
    const projectPath = mkdtempSync(join(tmpdir(), 'boilerplate-finish-norelease-'))

    try {
      writeProjectFile(
        projectPath,
        '.boilerstone/boilerplate.json',
        `${JSON.stringify(
          {
            schemaVersion: 1,
            source: { repository: 'lonestone/lonestone-boilerplate', currentVersion: '1.0.0' },
            trackedDomains: [],
            intentions: { applied: [], skipped: [] },
          },
          null,
          2,
        )}\n`,
      )

      const finish = runCli(['upgrade', 'finish', '--project', projectPath, '--to', '9.9.9'])

      expect(finish.status).toBe(1)
      expect(finish.stderr).toContain('release v9.9.9 is not available locally')
      expect(finish.stderr).toContain('refs/boilerstone/v*')
      const state = JSON.parse(
        readFileSync(join(projectPath, '.boilerstone/boilerplate.json'), 'utf-8'),
      )
      expect(state.source.currentVersion).toBe('1.0.0')
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
    }
  })

  it('prepares an upgrade workspace in a consumer project', () => {
    const projectPath = createGitRepo('boilerplate-prepare-')

    try {
      mkdirSync(join(projectPath, '.boilerstone'), { recursive: true })
      writeFileSync(
        join(projectPath, '.boilerstone', 'boilerplate.json'),
        `${JSON.stringify(
          {
            schemaVersion: 1,
            source: { repository: 'lonestone/lonestone-boilerplate', currentVersion: '0.9.0' },
            trackedDomains: [],
            intentions: { applied: [], skipped: [] },
          },
          null,
          2,
        )}\n`,
      )
      runGit(projectPath, ['add', '-A'])
      runGit(projectPath, ['commit', '-m', 'init'])

      const result = runCli(['upgrade', 'prepare', '--project', projectPath, '--to', '1.0.0'])

      expect(result.status, result.stderr).toBe(0)
      expect(existsSync(join(projectPath, '.boilerstone', 'upgrade', 'upgrade-session.md'))).toBe(
        true,
      )
      expect(
        existsSync(
          join(
            projectPath,
            '.boilerstone',
            'upgrade',
            'intentions',
            '01-v1.0.0-standardize-oxlint-oxfmt.md',
          ),
        ),
      ).toBe(true)
      const referenceReadme = readFileSync(
        join(projectPath, '.boilerstone', 'upgrade', 'reference', 'README.md'),
        'utf-8',
      )
      expect(referenceReadme).toContain('Target ref (source of truth): `v1.0.0`')
      expect(referenceReadme).toContain('`reference/target/` is a disposable projection')
      expect(referenceReadme).toContain('show v1.0.0:<path>')
      expect(referenceReadme).toContain('| `.oxfmtrc.json` | copy |')
      expect(referenceReadme).toContain('| `package.json` | adapt |')

      const sessionPrompt = readFileSync(
        join(projectPath, '.boilerstone', 'upgrade', 'upgrade-session.md'),
        'utf-8',
      )
      expect(sessionPrompt).toContain('You are the executor')
      expect(sessionPrompt).toContain('archive v1.0.0 -- <path>')
      expect(sessionPrompt).toContain('Target ref (source of truth): `v1.0.0`')
      expect(sessionPrompt).toContain('**copy**: copy the target projection verbatim')
      expect(sessionPrompt).toContain('**adapt**: compare project, source, and target')
      expect(sessionPrompt).toContain('- [ ] 1. `v1.0.0/standardize-oxlint-oxfmt` (migration)')

      const branch = spawnSync('git', ['branch', '--show-current'], {
        cwd: projectPath,
        encoding: 'utf-8',
        env: isolatedGitEnv(),
      }).stdout.trim()
      expect(branch).toBe('upgrade/v0.9.0-to-v1.0.0')

      const record = runCli([
        'upgrade',
        'record',
        '--project',
        projectPath,
        '--id',
        'v1.0.0/standardize-oxlint-oxfmt',
        '--applied',
      ])
      expect(record.status).toBe(0)
      expect(
        readFileSync(join(projectPath, '.boilerstone', 'upgrade', 'upgrade-session.md'), 'utf-8'),
      ).toContain('- [x] 1. `v1.0.0/standardize-oxlint-oxfmt` (migration)')
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
    }
  })

  it('runs the dirty-worktree preflight before any required publication fetch', () => {
    const projectPath = createGitRepo('boilerplate-prepare-dirty-preflight-')

    try {
      writeProjectFile(
        projectPath,
        '.boilerstone/boilerplate.json',
        `${JSON.stringify({
          schemaVersion: 1,
          source: {
            repository: 'lonestone/lonestone-boilerplate',
            remote: '/sentinel/must-not-be-fetched',
            currentVersion: '1.0.0',
          },
          trackedDomains: [],
          intentions: { applied: [], skipped: [] },
        })}\n`,
      )
      runGit(projectPath, ['add', '-A'])
      runGit(projectPath, ['commit', '-m', 'consumer project'])
      writeProjectFile(projectPath, 'dirty.txt', 'uncommitted\n')

      const result = runCli([
        'upgrade',
        'prepare',
        '--project',
        projectPath,
        '--to',
        'latest',
        '--fetch',
      ])

      expect(result.status).toBe(1)
      expect(result.stderr).toContain('Git worktree is dirty')
      expect(result.stderr).not.toContain('/sentinel/must-not-be-fetched')
      expect(result.stderr).not.toContain('Failed to fetch releases')
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
    }
  })

  it('preserves an existing workspace before any required publication fetch', () => {
    const projectPath = createGitRepo('boilerplate-prepare-workspace-preflight-')

    try {
      writeProjectFile(
        projectPath,
        '.boilerstone/boilerplate.json',
        `${JSON.stringify({
          schemaVersion: 1,
          source: {
            repository: 'lonestone/lonestone-boilerplate',
            remote: '/sentinel/must-not-be-fetched',
            currentVersion: '1.0.0',
          },
          trackedDomains: [],
          intentions: { applied: [], skipped: [] },
        })}\n`,
      )
      writeProjectFile(projectPath, '.gitignore', '.boilerstone/upgrade/\n')
      runGit(projectPath, ['add', '-A'])
      runGit(projectPath, ['commit', '-m', 'consumer project'])
      writeProjectFile(projectPath, '.boilerstone/upgrade/keep.txt', 'unfinished work\n')

      const result = runCli([
        'upgrade',
        'prepare',
        '--project',
        projectPath,
        '--to',
        'latest',
        '--fetch',
      ])

      expect(result.status).toBe(1)
      expect(result.stderr).toContain('An upgrade workspace already exists')
      expect(result.stderr).not.toContain('/sentinel/must-not-be-fetched')
      expect(result.stderr).not.toContain('Failed to fetch releases')
      expect(readFileSync(join(projectPath, '.boilerstone/upgrade/keep.txt'), 'utf-8')).toBe(
        'unfinished work\n',
      )
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
    }
  })

  it('prepares only selected intentions when exclusions are provided', () => {
    const projectPath = createGitRepo('boilerplate-prepare-filtered-')

    try {
      mkdirSync(join(projectPath, '.boilerstone'), { recursive: true })
      writeFileSync(
        join(projectPath, '.boilerstone', 'boilerplate.json'),
        `${JSON.stringify(
          {
            schemaVersion: 1,
            source: { repository: 'lonestone/lonestone-boilerplate', currentVersion: '0.0.0' },
            trackedDomains: [],
            intentions: { applied: [], skipped: [] },
          },
          null,
          2,
        )}\n`,
      )
      runGit(projectPath, ['add', '-A'])
      runGit(projectPath, ['commit', '-m', 'init'])

      const result = runCli([
        'upgrade',
        'prepare',
        '--project',
        projectPath,
        '--to',
        '1.0.0',
        '--exclude',
        'v1.0.0/adopt-ai-module-baseline',
      ])

      expect(result.status).toBe(0)
      const stagedIntentionFiles = readdirSync(
        join(projectPath, '.boilerstone', 'upgrade', 'intentions'),
      )
      expect(
        stagedIntentionFiles.some((file) => file.endsWith('adopt-ai-module-baseline.md')),
      ).toBe(false)
      expect(stagedIntentionFiles).toContain('01-v1.0.0-standardize-oxlint-oxfmt.md')
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
    }
  })

  it('refuses to stage an intention without its required dependency', () => {
    const projectPath = createGitRepo('boilerplate-prepare-missing-dep-')

    try {
      mkdirSync(join(projectPath, '.boilerstone'), { recursive: true })
      writeFileSync(
        join(projectPath, '.boilerstone', 'boilerplate.json'),
        `${JSON.stringify(
          {
            schemaVersion: 1,
            source: { repository: 'lonestone/lonestone-boilerplate', currentVersion: '0.0.0' },
            trackedDomains: [],
            intentions: { applied: [], skipped: [] },
          },
          null,
          2,
        )}\n`,
      )
      runGit(projectPath, ['add', '-A'])
      runGit(projectPath, ['commit', '-m', 'init'])

      const result = runCli([
        'upgrade',
        'prepare',
        '--project',
        projectPath,
        '--to',
        '1.0.0',
        '--include',
        'v1.0.0/align-shared-dependency-versions',
      ])

      expect(result.status).toBe(1)
      expect(result.stderr).toContain('requires v1.0.0/align-dependency-baseline')
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
    }
  })

  it('routes bare `upgrade` to prepare with defaults', () => {
    const projectPath = mkdtempSync(join(tmpdir(), 'boilerplate-bare-upgrade-'))
    const result = runCli(['upgrade', '--project', projectPath], projectPath)

    // Uninitialized project: prepare's own guidance proves the routing worked
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('No boilerplate.json found')
  })

  it('never treats the consumer own version tags as boilerplate releases', () => {
    const projectPath = createGitRepo('boilerplate-owntags-')

    try {
      mkdirSync(join(projectPath, '.boilerstone'), { recursive: true })
      // A real onboarded consumer ships .boilerstone/README.md — that alone must
      // not turn the app's own release tags into boilerplate releases.
      writeFileSync(join(projectPath, '.boilerstone', 'README.md'), '# boilerstone\n')
      writeFileSync(
        join(projectPath, '.boilerstone', 'boilerplate.json'),
        `${JSON.stringify(
          {
            schemaVersion: 1,
            source: { repository: 'lonestone/lonestone-boilerplate', currentVersion: '0.0.0' },
            trackedDomains: [],
            intentions: { applied: [], skipped: [] },
          },
          null,
          2,
        )}\n`,
      )
      runGit(projectPath, ['add', '-A'])
      runGit(projectPath, ['commit', '-m', 'app release'])
      runGit(projectPath, ['tag', 'v5.0.0'])

      const result = runCli([
        'upgrade',
        'path',
        '--project',
        projectPath,
        '--to',
        'latest',
        '--json',
      ])

      expect(result.status).toBe(0)
      const payload = JSON.parse(result.stdout)
      // latest must resolve to the boilerplate's release, not the app's v5.0.0
      expect(payload.targetVersion).toBe('1.1.0')
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
    }
  })

  it('stages the target reference even when the 0.0.0 source tag does not exist', () => {
    const projectPath = createGitRepo('boilerplate-prepare-nosource-')

    try {
      mkdirSync(join(projectPath, '.boilerstone', 'migration-intentions', 'v9.9.9'), {
        recursive: true,
      })
      mkdirSync(join(projectPath, 'apps'), { recursive: true })
      writeFileSync(join(projectPath, 'apps', 'demo.txt'), 'reference me\n')
      // A tag counts as a release only with .boilerstone/README.md and a release README
      writeFileSync(join(projectPath, '.boilerstone', 'README.md'), '# boilerstone\n')
      writeFileSync(
        join(projectPath, '.boilerstone', 'migration-intentions', 'v9.9.9', 'README.md'),
        '# v9.9.9\n',
      )
      writeFileSync(
        join(projectPath, '.boilerstone', 'migration-intentions', 'v9.9.9', 'demo.md'),
        [
          '---',
          'id: v9.9.9/demo',
          'domain: storage',
          'classification: migration',
          '---',
          '',
          '# Demo',
          '',
          '## Reference Paths',
          '',
          '- `apps/demo.txt`',
        ].join('\n'),
      )
      writeFileSync(
        join(projectPath, '.boilerstone', 'boilerplate.json'),
        `${JSON.stringify(
          {
            schemaVersion: 1,
            source: { repository: 'lonestone/lonestone-boilerplate', currentVersion: '0.0.0' },
            trackedDomains: ['storage'],
            intentions: { applied: [], skipped: [] },
          },
          null,
          2,
        )}\n`,
      )
      runGit(projectPath, ['add', '-A'])
      runGit(projectPath, ['commit', '-m', 'init'])
      runGit(projectPath, ['tag', 'v9.9.9'])

      // v-prefixed --to must be accepted and normalized
      const result = runCli(['upgrade', 'prepare', '--project', projectPath, '--to', 'v9.9.9'])

      expect(result.status, result.stderr).toBe(0)
      const upgradeDir = join(projectPath, '.boilerstone', 'upgrade')
      expect(existsSync(join(upgradeDir, 'reference', 'source', 'NO-SOURCE-REFERENCE.md'))).toBe(
        true,
      )
      expect(existsSync(join(upgradeDir, 'reference', 'target', 'apps', 'demo.txt'))).toBe(true)
      expect(
        existsSync(join(upgradeDir, 'reference', 'target', '.boilerstone', 'boilerplate.json')),
      ).toBe(true)
      expect(result.stdout).toContain('upgrade/v0.0.0-to-v9.9.9')
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
    }
  })

  it('stages declared adapt paths from both source and target refs', async () => {
    const projectPath = createGitRepo('boilerplate-prepare-three-way-')

    try {
      writeProjectFile(projectPath, '.boilerstone/README.md', '# boilerstone\n')
      writeProjectFile(
        projectPath,
        '.boilerstone/boilerplate.json',
        `${JSON.stringify(
          {
            schemaVersion: 1,
            source: { repository: 'lonestone/lonestone-boilerplate', currentVersion: '1.0.0' },
            trackedDomains: [],
            intentions: { applied: [], skipped: [] },
          },
          null,
          2,
        )}\n`,
      )
      writeProjectFile(
        projectPath,
        '.boilerstone/migration-intentions/v1.0.0/README.md',
        '# v1.0.0\n',
      )
      writeProjectFile(projectPath, 'apps/demo.txt', 'source version\n')
      runGit(projectPath, ['add', '-A'])
      runGit(projectPath, ['commit', '-m', 'source release'])
      runGit(projectPath, ['tag', 'v1.0.0'])

      writeProjectFile(
        projectPath,
        '.boilerstone/migration-intentions/v1.1.0/README.md',
        '# v1.1.0\n',
      )
      writeProjectFile(
        projectPath,
        '.boilerstone/migration-intentions/v1.1.0/01-update-demo.md',
        [
          '---',
          'id: v1.1.0/update-demo',
          'domain: tooling',
          'classification: migration',
          '---',
          '',
          '## Reference Paths',
          '',
          '- `apps/demo.txt` — **adapt**',
        ].join('\n'),
      )
      writeProjectFile(projectPath, 'apps/demo.txt', 'target version\n')
      runGit(projectPath, ['add', '-A'])
      runGit(projectPath, ['commit', '-m', 'target release'])
      runGit(projectPath, ['tag', 'v1.1.0'])

      let selectableIds: string[] = []
      const result = await prepareUpgrade({
        projectPath,
        toVersion: '1.1.0',
        fetch: false,
        includeIds: [],
        excludeIds: [],
        selectIntentions: async (path) => {
          selectableIds = path.intentions.map((intention) => intention.id)
          return path
        },
      })

      expect(result.targetRelease.version).toBe('1.1.0')
      expect(result.targetReference.label).toBe('v1.1.0')
      expect(result.targetReference.provenance).toBe('consumer-ref')
      expect(selectableIds).toEqual(['v1.1.0/update-demo'])
      const referenceDir = join(projectPath, '.boilerstone', 'upgrade', 'reference')
      expect(readFileSync(join(referenceDir, 'source', 'apps', 'demo.txt'), 'utf-8')).toBe(
        'source version\n',
      )
      expect(readFileSync(join(referenceDir, 'target', 'apps', 'demo.txt'), 'utf-8')).toBe(
        'target version\n',
      )
      expect(readFileSync(join(referenceDir, 'README.md'), 'utf-8')).toContain(
        '| `apps/demo.txt` | adapt | staged | staged |',
      )
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
    }
  })

  it('prepares a complete producer draft from the producer HEAD', async () => {
    const projectPath = createGitRepo('boilerplate-prepare-draft-consumer-')
    const producerPath = createGitRepo('boilerplate-prepare-draft-producer-')

    try {
      writeProjectFile(
        projectPath,
        '.boilerstone/boilerplate.json',
        `${JSON.stringify({
          schemaVersion: 1,
          source: { repository: 'lonestone/lonestone-boilerplate', currentVersion: '0.0.0' },
          trackedDomains: ['tooling'],
          intentions: { applied: [], skipped: [] },
        })}\n`,
      )
      runGit(projectPath, ['add', '-A'])
      runGit(projectPath, ['commit', '-m', 'consumer project'])

      writeProjectFile(
        producerPath,
        '.boilerstone/migration-intentions/v9.9.9/README.md',
        '# v9.9.9 draft\n',
      )
      writeProjectFile(
        producerPath,
        '.boilerstone/migration-intentions/v9.9.9/01-draft-example.md',
        [
          '---',
          'id: v9.9.9/draft-example',
          'domain: tooling',
          'classification: migration',
          '---',
          '',
          '## Goal',
          '',
          'Committed producer HEAD intention.',
          '',
          '## Reference Paths',
          '',
          '- `apps/draft.txt` — **copy**',
        ].join('\n'),
      )
      writeProjectFile(producerPath, 'apps/draft.txt', 'committed producer HEAD reference\n')
      runGit(producerPath, ['add', '-A'])
      runGit(producerPath, ['commit', '-m', 'draft release'])

      const result = await prepareUpgrade({
        projectPath,
        producerPath,
        toVersion: '9.9.9',
        fetch: false,
        includeIds: [],
        excludeIds: [],
        selectIntentions: async (path) => path,
      })

      expect(result.targetReference.provenance).toBe('producer-draft')
      expect(result.targetReference.ref).toBe('HEAD')
      expect(result.stagedIntentionCount).toBe(1)
      const upgradeDir = join(projectPath, '.boilerstone/upgrade')
      expect(
        readFileSync(join(upgradeDir, 'intentions/01-v9.9.9-draft-example.md'), 'utf-8'),
      ).toContain('Committed producer HEAD intention.')
      expect(readFileSync(join(upgradeDir, 'reference/target/apps/draft.txt'), 'utf-8')).toBe(
        'committed producer HEAD reference\n',
      )
      expect(readFileSync(join(upgradeDir, 'reference/README.md'), 'utf-8')).toContain(
        'producer checkout HEAD is the temporary source of truth',
      )
      expect(
        spawnSync('git', ['branch', '--show-current'], {
          cwd: projectPath,
          encoding: 'utf-8',
          env: isolatedGitEnv(),
        }).stdout.trim(),
      ).toBe('upgrade/v0.0.0-to-v9.9.9')
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
      rmSync(producerPath, { recursive: true, force: true })
    }
  })

  it('refuses a dirty producer draft before creating a branch or workspace', async () => {
    const projectPath = createGitRepo('boilerplate-prepare-dirty-draft-consumer-')
    const producerPath = createGitRepo('boilerplate-prepare-dirty-draft-producer-')

    try {
      writeProjectFile(
        projectPath,
        '.boilerstone/boilerplate.json',
        `${JSON.stringify({
          schemaVersion: 1,
          source: { repository: 'lonestone/lonestone-boilerplate', currentVersion: '0.0.0' },
          trackedDomains: [],
          intentions: { applied: [], skipped: [] },
        })}\n`,
      )
      runGit(projectPath, ['add', '-A'])
      runGit(projectPath, ['commit', '-m', 'consumer project'])
      const initialBranch = spawnSync('git', ['branch', '--show-current'], {
        cwd: projectPath,
        encoding: 'utf-8',
        env: isolatedGitEnv(),
      }).stdout.trim()

      writeProjectFile(
        producerPath,
        '.boilerstone/migration-intentions/v9.9.9/README.md',
        '# v9.9.9 draft\n',
      )
      writeProjectFile(
        producerPath,
        '.boilerstone/migration-intentions/v9.9.9/01-example.md',
        createIntentionContent({
          id: 'v9.9.9/example',
          domain: 'tooling',
          classification: 'migration',
        }),
      )
      runGit(producerPath, ['add', '-A'])
      runGit(producerPath, ['commit', '-m', 'draft release'])
      // Dirt outside .boilerstone/ (build artifacts, scratch files) must not
      // block preparation — only the tree the draft serves counts.
      writeProjectFile(producerPath, 'dirty.txt', 'uncommitted producer change\n')
      writeProjectFile(producerPath, '.boilerstone/notes.md', 'uncommitted draft change\n')

      await expect(
        prepareUpgrade({
          projectPath,
          producerPath,
          toVersion: '9.9.9',
          fetch: false,
          includeIds: [],
          excludeIds: [],
          selectIntentions: async (path) => path,
        }),
      ).rejects.toThrow('Producer .boilerstone/ has uncommitted changes')
      expect(existsSync(join(projectPath, '.boilerstone/upgrade'))).toBe(false)
      expect(
        spawnSync('git', ['branch', '--show-current'], {
          cwd: projectPath,
          encoding: 'utf-8',
          env: isolatedGitEnv(),
        }).stdout.trim(),
      ).toBe(initialBranch)
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
      rmSync(producerPath, { recursive: true, force: true })
    }
  })

  it('refuses an uncommitted producer draft release before creating a workspace', async () => {
    const projectPath = createGitRepo('boilerplate-prepare-uncommitted-draft-consumer-')
    const producerPath = createGitRepo('boilerplate-prepare-uncommitted-draft-producer-')

    try {
      writeProjectFile(
        projectPath,
        '.boilerstone/boilerplate.json',
        `${JSON.stringify({
          schemaVersion: 1,
          source: { repository: 'lonestone/lonestone-boilerplate', currentVersion: '0.0.0' },
          trackedDomains: [],
          intentions: { applied: [], skipped: [] },
        })}\n`,
      )
      runGit(projectPath, ['add', '-A'])
      runGit(projectPath, ['commit', '-m', 'consumer project'])
      writeProjectFile(producerPath, 'README.md', '# producer\n')
      runGit(producerPath, ['add', '-A'])
      runGit(producerPath, ['commit', '-m', 'producer baseline'])
      writeProjectFile(
        producerPath,
        '.boilerstone/migration-intentions/v9.9.9/README.md',
        '# uncommitted draft\n',
      )
      writeProjectFile(
        producerPath,
        '.boilerstone/migration-intentions/v9.9.9/01-example.md',
        createIntentionContent({
          id: 'v9.9.9/example',
          domain: 'tooling',
          classification: 'migration',
        }),
      )

      await expect(
        prepareUpgrade({
          projectPath,
          producerPath,
          toVersion: '9.9.9',
          fetch: false,
          includeIds: [],
          excludeIds: [],
          selectIntentions: async (path) => path,
        }),
      ).rejects.toThrow('Draft release v9.9.9 must exist in producer HEAD')
      expect(existsSync(join(projectPath, '.boilerstone/upgrade'))).toBe(false)
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
      rmSync(producerPath, { recursive: true, force: true })
    }
  })

  it('refuses an incomplete copy target without creating a branch or workspace', () => {
    const projectPath = createGitRepo('boilerplate-prepare-missing-copy-')

    try {
      writeProjectFile(projectPath, '.boilerstone/README.md', '# boilerstone\n')
      writeProjectFile(
        projectPath,
        '.boilerstone/boilerplate.json',
        `${JSON.stringify(
          {
            schemaVersion: 1,
            source: { repository: 'lonestone/lonestone-boilerplate', currentVersion: '0.0.0' },
            trackedDomains: [],
            intentions: { applied: [], skipped: [] },
          },
          null,
          2,
        )}\n`,
      )
      writeProjectFile(
        projectPath,
        '.boilerstone/migration-intentions/v1.1.0/README.md',
        '# v1.1.0\n',
      )
      writeProjectFile(
        projectPath,
        '.boilerstone/migration-intentions/v1.1.0/01-copy-missing.md',
        [
          '---',
          'id: v1.1.0/copy-missing',
          'domain: tooling',
          'classification: migration',
          '---',
          '',
          '## Reference Paths',
          '',
          '- `apps/missing.txt` — **copy**',
        ].join('\n'),
      )
      runGit(projectPath, ['add', '-A'])
      runGit(projectPath, ['commit', '-m', 'release with missing copy source'])
      runGit(projectPath, ['tag', 'v1.1.0'])
      const initialBranch = spawnSync('git', ['branch', '--show-current'], {
        cwd: projectPath,
        encoding: 'utf-8',
        env: isolatedGitEnv(),
      }).stdout.trim()

      const result = runCli(['upgrade', 'prepare', '--project', projectPath, '--to', '1.1.0'])

      expect(result.status).toBe(1)
      expect(result.stderr).toContain('copy reference path is missing from the target ref')
      expect(existsSync(join(projectPath, '.boilerstone', 'upgrade'))).toBe(false)
      expect(
        readdirSync(join(projectPath, '.boilerstone')).some((file) =>
          file.startsWith('upgrade.tmp-'),
        ),
      ).toBe(false)
      expect(
        spawnSync('git', ['branch', '--show-current'], {
          cwd: projectPath,
          encoding: 'utf-8',
          env: isolatedGitEnv(),
        }).stdout.trim(),
      ).toBe(initialBranch)
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
    }
  })

  it('refuses to prepare an empty path and suggests checking the source version', () => {
    const projectPath = createGitRepo('boilerplate-prepare-empty-')

    try {
      mkdirSync(join(projectPath, '.boilerstone'), { recursive: true })
      writeFileSync(
        join(projectPath, '.boilerstone', 'boilerplate.json'),
        `${JSON.stringify(
          {
            schemaVersion: 1,
            source: { repository: 'lonestone/lonestone-boilerplate', currentVersion: '1.0.0' },
            trackedDomains: [],
            intentions: { applied: [], skipped: [] },
          },
          null,
          2,
        )}\n`,
      )
      runGit(projectPath, ['add', '-A'])
      runGit(projectPath, ['commit', '-m', 'init'])

      const result = runCli(['upgrade', 'prepare', '--project', projectPath, '--to', '1.0.0'])

      expect(result.status).toBe(1)
      expect(result.stderr).toContain('No intentions apply between v1.0.0 and v1.0.0')
      expect(result.stderr).toContain('never replayed')
      expect(result.stderr).toContain('in .boilerstone/boilerplate.json (e.g. 0.0.0)')
      expect(existsSync(join(projectPath, '.boilerstone/upgrade'))).toBe(false)
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
    }
  })

  it('refuses to prepare when the upgrade branch already exists', () => {
    const projectPath = createGitRepo('boilerplate-existing-branch-')

    try {
      mkdirSync(join(projectPath, '.boilerstone'), { recursive: true })
      writeFileSync(
        join(projectPath, '.boilerstone', 'boilerplate.json'),
        `${JSON.stringify(
          {
            schemaVersion: 1,
            source: { repository: 'lonestone/lonestone-boilerplate', currentVersion: '0.9.0' },
            trackedDomains: [],
            intentions: { applied: [], skipped: [] },
          },
          null,
          2,
        )}\n`,
      )
      runGit(projectPath, ['add', '-A'])
      runGit(projectPath, ['commit', '-m', 'init'])
      // Pre-create the target branch without checking it out
      runGit(projectPath, ['branch', 'upgrade/v0.9.0-to-v1.0.0'])

      const result = runCli(['upgrade', 'prepare', '--project', projectPath, '--to', '1.0.0'])

      expect(result.status).toBe(1)
      expect(result.stderr).toContain('already exists')
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
    }
  })

  it('preserves an existing workspace on the active upgrade branch', () => {
    const projectPath = createGitRepo('boilerplate-existing-workspace-')

    try {
      writeProjectFile(
        projectPath,
        '.boilerstone/boilerplate.json',
        `${JSON.stringify(
          {
            schemaVersion: 1,
            source: { repository: 'lonestone/lonestone-boilerplate', currentVersion: '0.9.0' },
            trackedDomains: [],
            intentions: { applied: [], skipped: [] },
          },
          null,
          2,
        )}\n`,
      )
      writeProjectFile(projectPath, '.gitignore', '.boilerstone/upgrade/\n')
      runGit(projectPath, ['add', '-A'])
      runGit(projectPath, ['commit', '-m', 'init'])
      runGit(projectPath, ['checkout', '-b', 'upgrade/v0.9.0-to-v1.0.0'])
      writeProjectFile(projectPath, '.boilerstone/upgrade/keep.txt', 'unfinished work\n')

      const result = runCli(['upgrade', 'prepare', '--project', projectPath, '--to', '1.0.0'])

      expect(result.status).toBe(1)
      expect(result.stderr).toContain('An upgrade workspace already exists')
      expect(readFileSync(join(projectPath, '.boilerstone/upgrade/keep.txt'), 'utf-8')).toBe(
        'unfinished work\n',
      )
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
    }
  })

  it('fails clearly on a malformed boilerplate.json', () => {
    const projectPath = mkdtempSync(join(tmpdir(), 'boilerplate-malformed-'))

    mkdirSync(join(projectPath, '.boilerstone'), { recursive: true })
    writeFileSync(
      join(projectPath, '.boilerstone', 'boilerplate.json'),
      JSON.stringify({ schemaVersion: 1 }),
    )

    const result = runCli(['upgrade', 'status', '--project', projectPath], projectPath)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Malformed')
  })
})

describe('bootstrap command', () => {
  it('wires a consumer project and switches .boilerstone to consumer mode', () => {
    const projectPath = mkdtempSync(join(tmpdir(), 'boilerplate-bootstrap-'))

    try {
      writeProjectFile(
        projectPath,
        'package.json',
        `${JSON.stringify({ name: 'legacy-app', scripts: { dev: 'vite' } }, null, 2)}\n`,
      )
      writeProjectFile(projectPath, '.gitignore', 'node_modules\n')
      writeProjectFile(
        projectPath,
        '.boilerstone/boilerplate.json',
        `${JSON.stringify(
          {
            schemaVersion: 1,
            source: { repository: 'lonestone/lonestone-boilerplate', currentVersion: '1.0.0' },
            trackedDomains: [],
            intentions: { applied: [], skipped: [] },
          },
          null,
          2,
        )}\n`,
      )
      writeProjectFile(projectPath, '.boilerstone/boilerplate.example.json', '{}')
      writeProjectFile(projectPath, '.boilerstone/migration-intentions/TEMPLATE.md', '# Template')
      writeProjectFile(projectPath, '.boilerstone/docs/upgrade-runbook.md', '# Runbook')

      // boilerplate.json already exists, so init returns early (no interactive prompt)
      const result = runCli(['bootstrap', '--project', projectPath])

      expect(result.status).toBe(0)

      const pkg = JSON.parse(readFileSync(join(projectPath, 'package.json'), 'utf-8'))
      expect(pkg.scripts.boilerplate).toBe('tsx ./.boilerstone/cli/boilerplate.ts')
      expect(pkg.devDependencies.tsx).toBeTruthy()
      expect(readFileSync(join(projectPath, '.gitignore'), 'utf-8')).toContain(
        '.boilerstone/upgrade/',
      )

      // Producer-only artifacts dropped, consumer files preserved
      expect(existsSync(join(projectPath, '.boilerstone/migration-intentions'))).toBe(false)
      expect(existsSync(join(projectPath, '.boilerstone/boilerplate.example.json'))).toBe(false)
      expect(existsSync(join(projectPath, '.boilerstone/docs/upgrade-runbook.md'))).toBe(true)
      expect(existsSync(join(projectPath, '.boilerstone/boilerplate.json'))).toBe(true)
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
    }
  })

  it('initializes tracking when onboarding a project without boilerplate.json', () => {
    const projectPath = mkdtempSync(join(tmpdir(), 'boilerplate-bootstrap-init-'))

    try {
      writeProjectFile(
        projectPath,
        'package.json',
        `${JSON.stringify({ name: 'legacy-app', scripts: { dev: 'vite' } }, null, 2)}\n`,
      )
      writeProjectFile(projectPath, '.gitignore', 'node_modules\n')
      writeProjectFile(projectPath, '.boilerstone/boilerplate.example.json', '{}')
      writeProjectFile(projectPath, '.boilerstone/migration-intentions/TEMPLATE.md', '# Template')
      writeProjectFile(projectPath, '.boilerstone/docs/upgrade-runbook.md', '# Runbook')

      const result = runCli(['bootstrap', '--project', projectPath], undefined, {
        BOILERPLATE_SOURCE_VERSION: '0.9.0',
        BOILERPLATE_SOURCE_COMMIT: '1234567890abcdef',
        BOILERPLATE_REPO: '/tmp/local-boilerplate',
      })

      expect(result.status).toBe(0)
      const state = JSON.parse(
        readFileSync(join(projectPath, '.boilerstone/boilerplate.json'), 'utf-8'),
      )
      expect(state.source.currentVersion).toBe('0.9.0')
      expect(state.source.commit).toBe('1234567890abcdef')
      expect(state.source.remote).toBe('/tmp/local-boilerplate')
      expect(existsSync(join(projectPath, '.boilerstone/migration-intentions'))).toBe(false)
    } finally {
      rmSync(projectPath, { recursive: true, force: true })
    }
  })
})

describe('setup cleanup', () => {
  it('switches .boilerstone to consumer mode without losing local upgrade state', () => {
    const projectPath = mkdtempSync(join(tmpdir(), 'boilerplate-consumer-cleanup-'))
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const previousVersion = process.env.BOILERPLATE_SOURCE_VERSION
    const previousCommit = process.env.BOILERPLATE_SOURCE_COMMIT

    try {
      process.env.BOILERPLATE_SOURCE_VERSION = '1.2.3'
      process.env.BOILERPLATE_SOURCE_COMMIT = 'abcdef1234567890'

      writeProjectFile(
        projectPath,
        '.boilerstone/boilerplate.example.json',
        `${JSON.stringify(
          {
            schemaVersion: 1,
            source: {
              repository: 'lonestone/lonestone-boilerplate',
              remote: 'https://github.com/lonestone/lonestone-boilerplate.git',
              currentVersion: '1.0.0',
            },
            trackedDomains: ['tooling'],
            intentions: { applied: [], skipped: [] },
          },
          null,
          2,
        )}\n`,
      )
      writeProjectFile(projectPath, '.boilerstone/boilerplate.schema.json', '{}')
      writeProjectFile(projectPath, '.boilerstone/README.md', '# Upgrade system')
      writeProjectFile(projectPath, '.boilerstone/cli/boilerplate.ts', 'export {}')
      writeProjectFile(projectPath, '.boilerstone/docs/upgrade-runbook.md', '# Runbook')
      writeProjectFile(projectPath, '.boilerstone/docs/ai-upgrades-implementation.md', '# Internal')
      writeProjectFile(projectPath, '.boilerstone/docs/pilot-rollout.md', '# Pilot')
      writeProjectFile(projectPath, '.boilerstone/migration-intentions/TEMPLATE.md', '# Template')
      writeProjectFile(projectPath, 'install.sh', '#!/usr/bin/env sh\n')

      cleanupBoilerplateFiles(projectPath)

      expect(existsSync(join(projectPath, '.boilerstone/boilerplate.json'))).toBe(true)
      expect(
        JSON.parse(readFileSync(join(projectPath, '.boilerstone/boilerplate.json'), 'utf-8')).source
          .remote,
      ).toBe('https://github.com/lonestone/lonestone-boilerplate.git')
      expect(
        JSON.parse(readFileSync(join(projectPath, '.boilerstone/boilerplate.json'), 'utf-8')).source
          .currentVersion,
      ).toBe('1.2.3')
      expect(
        JSON.parse(readFileSync(join(projectPath, '.boilerstone/boilerplate.json'), 'utf-8')).source
          .commit,
      ).toBe('abcdef1234567890')
      expect(existsSync(join(projectPath, '.boilerstone/boilerplate.schema.json'))).toBe(true)
      expect(existsSync(join(projectPath, '.boilerstone/cli/boilerplate.ts'))).toBe(true)
      expect(existsSync(join(projectPath, '.boilerstone/docs/upgrade-runbook.md'))).toBe(true)

      expect(existsSync(join(projectPath, '.boilerstone/boilerplate.example.json'))).toBe(false)
      expect(existsSync(join(projectPath, '.boilerstone/migration-intentions'))).toBe(false)
      expect(existsSync(join(projectPath, '.boilerstone/docs/ai-upgrades-implementation.md'))).toBe(
        false,
      )
      expect(existsSync(join(projectPath, '.boilerstone/docs/pilot-rollout.md'))).toBe(false)
      expect(existsSync(join(projectPath, 'install.sh'))).toBe(false)
    } finally {
      if (previousVersion === undefined) {
        delete process.env.BOILERPLATE_SOURCE_VERSION
      } else {
        process.env.BOILERPLATE_SOURCE_VERSION = previousVersion
      }
      if (previousCommit === undefined) {
        delete process.env.BOILERPLATE_SOURCE_COMMIT
      } else {
        process.env.BOILERPLATE_SOURCE_COMMIT = previousCommit
      }
      logSpy.mockRestore()
      rmSync(projectPath, { recursive: true, force: true })
    }
  })

  it('keeps producer artifacts in a boilerplate maintainer checkout', () => {
    const projectPath = createGitRepo('boilerplate-maintainer-cleanup-')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    try {
      runGit(projectPath, [
        'remote',
        'add',
        'origin',
        'https://github.com/lonestone/lonestone-boilerplate.git',
      ])
      writeProjectFile(
        projectPath,
        '.boilerstone/boilerplate.example.json',
        `${JSON.stringify(
          {
            schemaVersion: 1,
            source: { repository: 'lonestone/lonestone-boilerplate', currentVersion: '1.0.0' },
            trackedDomains: [],
            intentions: { applied: [], skipped: [] },
          },
          null,
          2,
        )}\n`,
      )
      writeProjectFile(projectPath, '.boilerstone/migration-intentions/TEMPLATE.md', '# Template')
      writeProjectFile(projectPath, '.boilerstone/docs/ai-upgrades-implementation.md', '# Internal')

      cleanupBoilerplateFiles(projectPath)

      // boilerplate.json is still created, but producer-side files are preserved
      expect(existsSync(join(projectPath, '.boilerstone/boilerplate.json'))).toBe(true)
      expect(existsSync(join(projectPath, '.boilerstone/boilerplate.example.json'))).toBe(true)
      expect(existsSync(join(projectPath, '.boilerstone/migration-intentions'))).toBe(true)
      expect(existsSync(join(projectPath, '.boilerstone/docs/ai-upgrades-implementation.md'))).toBe(
        true,
      )
    } finally {
      logSpy.mockRestore()
      rmSync(projectPath, { recursive: true, force: true })
    }
  })
})
