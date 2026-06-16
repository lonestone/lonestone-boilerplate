import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { cleanupBoilerplateFiles } from '../../cli/setup'
import { archiveGitReference } from './boilerplate'
import {
  compareVersions,
  computeUpgradePath,
  getFallbackIntentionId,
  parseIntentionMetadataContent,
  readOptionValue,
} from './boilerplate-core'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = resolve(__dirname, '../..')
const cliPath = join(projectRoot, '.boilerstone/cli/boilerplate.ts')

function getGitEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  delete env.GIT_DIR
  delete env.GIT_WORK_TREE
  return env
}

function createIntentionContent(options: { id?: string, domain?: string, classification?: string }): string {
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

function runCli(args: string[], projectPath?: string): { status: number | null, stdout: string, stderr: string } {
  const result = spawnSync('pnpm', ['exec', 'tsx', cliPath, ...args], {
    cwd: projectRoot,
    encoding: 'utf-8',
    env: {
      ...getGitEnv(),
      FORCE_COLOR: '0',
      NO_COLOR: '1',
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
  const result = spawnSync('git', args, { cwd, encoding: 'utf-8', env: getGitEnv() })
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
    expect(parseIntentionMetadataContent(createIntentionContent({
      id: 'v1.2.0/api-logger',
      domain: 'api',
      classification: 'migration',
    }))).toEqual({
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

    expect(parseIntentionMetadataContent('---\r\nid: v1.0.0/crlf\r\ndomain: api\r\nclassification: migration\r\n---\r\n\r\n## Goal\r\n').issues).toEqual([])

    expect(parseIntentionMetadataContent(createIntentionContent({
      id: 'v1.2.0/bad',
      domain: 'api',
      classification: 'manual-ish',
    })).issues).toEqual(['invalid classification: manual-ish', 'missing classification'])
  })

  it('rejects malformed option values', () => {
    expect(readOptionValue(['upgrade', 'path', '--to', '1.2.0'], '--to')).toBe('1.2.0')
    expect(readOptionValue(['upgrade', 'path'], '--to')).toBeUndefined()
    expect(() => readOptionValue(['upgrade', 'path', '--to'], '--to')).toThrow('--to requires a value')
    expect(() => readOptionValue(['upgrade', 'path', '--to', '--project'], '--to')).toThrow('--to requires a value')
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
      checkpoints: [
        { id: '0.9.0-to-1.1.0', targetVersion: '1.1.0', minSourceVersion: '0.0.0', file: 'checkpoint.md' },
      ],
      intentionFiles: [
        {
          releaseVersion: '1.1.0',
          file: 'api/logger.md',
          relativePath: 'api/logger.md',
          content: createIntentionContent({ id: 'v1.1.0/api-logger', domain: 'api', classification: 'migration' }),
        },
        {
          releaseVersion: '1.1.0',
          file: 'tooling/manual.md',
          relativePath: 'tooling/manual.md',
          content: createIntentionContent({ id: 'v1.1.0/manual', domain: 'tooling', classification: 'breaking-manual' }),
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
          content: createIntentionContent({ id: 'v1.1.0/domain-override', domain: 'api', classification: 'migration' }),
        },
        {
          releaseVersion: '1.1.0',
          file: 'frontend/ui.md',
          relativePath: 'frontend/ui.md',
          content: createIntentionContent({ id: 'v1.1.0/frontend-ui', domain: 'frontend', classification: 'migration' }),
        },
        {
          releaseVersion: '1.2.0',
          file: 'api/already-applied.md',
          relativePath: 'api/already-applied.md',
          content: createIntentionContent({ id: 'v1.2.0/already-applied', domain: 'api', classification: 'migration' }),
        },
        {
          releaseVersion: '1.2.0',
          file: 'api/already-skipped.md',
          relativePath: 'api/already-skipped.md',
          content: createIntentionContent({ id: 'v1.2.0/already-skipped', domain: 'api', classification: 'migration' }),
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
    expect(path.intentions.map(intention => intention.id)).toEqual([
      'v1.1.0/api-logger',
      'v1.1.0/api/nested/no-id',
      'v1.1.0/domain-override',
      'v1.1.0/manual',
      'v1.2.0/api/missing-metadata',
    ])
    expect(path.intentions.find(intention => intention.id === 'v1.1.0/domain-override')?.domain).toBe('api')
    expect(path.intentions.find(intention => intention.id === 'v1.2.0/api/missing-metadata')?.metadataIssues).toContain('missing frontmatter')
    expect(path.skippedByDomain).toEqual({ frontend: 1 })
    expect(path.alreadyResolvedCount).toBe(2)
    expect(path.classificationCounts.migration).toBe(7)
    expect(path.classificationCounts['breaking-manual']).toBe(1)
  })

  it('keeps nested fallback intention ids deterministic', () => {
    expect(getFallbackIntentionId('1.2.0', 'api/nested/update.md')).toBe('v1.2.0/api/nested/update')
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
    }
    finally {
      rmSync(repoDir, { recursive: true, force: true })
      rmSync(destDir, { recursive: true, force: true })
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

  it('reports missing state with init guidance', () => {
    const projectPath = mkdtempSync(join(tmpdir(), 'boilerplate-status-'))
    const result = runCli(['upgrade', 'status', '--project', projectPath], projectPath)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('No boilerplate.json found')
    expect(result.stdout).toContain('boilerplate upgrade init')
  })

  it('fails clearly when an option value is missing', () => {
    const result = runCli(['upgrade', 'path', '--to'])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('--to requires a value')
  })

  it('emits machine-readable status with --json', () => {
    const projectPath = mkdtempSync(join(tmpdir(), 'boilerplate-json-status-'))
    const result = runCli(['upgrade', 'status', '--project', projectPath, '--json'], projectPath)

    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual({ initialized: false })
  })

  it('emits machine-readable doctor failures with --json', () => {
    const projectPath = mkdtempSync(join(tmpdir(), 'boilerplate-json-doctor-'))
    const result = runCli(['upgrade', 'doctor', '--project', projectPath, '--json'], projectPath)

    expect(result.status).toBe(1)
    const payload = JSON.parse(result.stdout)
    expect(payload.initialized).toBe(false)
    expect(payload.summary.failed).toBeGreaterThan(0)
    expect(payload.checks.some((check: { name: string }) => check.name === 'boilerplate.json')).toBe(true)
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

  it('prepares an upgrade workspace in a consumer project', () => {
    const projectPath = createGitRepo('boilerplate-prepare-')

    try {
      mkdirSync(join(projectPath, '.boilerstone'), { recursive: true })
      writeFileSync(join(projectPath, '.boilerstone', 'boilerplate.json'), `${JSON.stringify({
        schemaVersion: 1,
        source: { repository: 'lonestone/lonestone-boilerplate', currentVersion: '0.9.0' },
        trackedDomains: [],
        intentions: { applied: [], skipped: [] },
      }, null, 2)}\n`)
      runGit(projectPath, ['add', '-A'])
      runGit(projectPath, ['commit', '-m', 'init'])

      const result = runCli(['upgrade', 'prepare', '--project', projectPath, '--to', '1.0.0'])

      expect(result.status).toBe(0)
      expect(existsSync(join(projectPath, '.boilerstone', 'upgrade', 'upgrade-session.md'))).toBe(true)
      expect(existsSync(join(projectPath, '.boilerstone', 'upgrade', 'status.md'))).toBe(true)

      const branch = spawnSync('git', ['branch', '--show-current'], { cwd: projectPath, encoding: 'utf-8', env: getGitEnv() }).stdout.trim()
      expect(branch).toBe('upgrade/v0.9.0-to-v1.0.0')
    }
    finally {
      rmSync(projectPath, { recursive: true, force: true })
    }
  })
})

describe('setup cleanup', () => {
  it('switches .boilerstone to consumer mode without losing local upgrade state', () => {
    const projectPath = mkdtempSync(join(tmpdir(), 'boilerplate-consumer-cleanup-'))
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    try {
      writeProjectFile(projectPath, '.boilerstone/boilerplate.example.json', `${JSON.stringify({
        schemaVersion: 1,
        source: {
          repository: 'lonestone/lonestone-boilerplate',
          remote: 'https://github.com/lonestone/lonestone-boilerplate.git',
          currentVersion: '1.0.0',
        },
        trackedDomains: ['tooling'],
        intentions: { applied: [], skipped: [] },
      }, null, 2)}\n`)
      writeProjectFile(projectPath, '.boilerstone/boilerplate.schema.json', '{}')
      writeProjectFile(projectPath, '.boilerstone/README.md', '# Upgrade system')
      writeProjectFile(projectPath, '.boilerstone/cli/boilerplate.ts', 'export {}')
      writeProjectFile(projectPath, '.boilerstone/docs/upgrade-runbook.md', '# Runbook')
      writeProjectFile(projectPath, '.boilerstone/docs/ai-upgrades-implementation.md', '# Internal')
      writeProjectFile(projectPath, '.boilerstone/docs/pilot-rollout.md', '# Pilot')
      writeProjectFile(projectPath, '.boilerstone/migration-intentions/TEMPLATE.md', '# Template')
      writeProjectFile(projectPath, '.boilerstone/legacy-checkpoints/README.md', '# Legacy')

      cleanupBoilerplateFiles(projectPath)

      expect(existsSync(join(projectPath, '.boilerstone/boilerplate.json'))).toBe(true)
      expect(JSON.parse(readFileSync(join(projectPath, '.boilerstone/boilerplate.json'), 'utf-8')).source.remote).toBe('https://github.com/lonestone/lonestone-boilerplate.git')
      expect(existsSync(join(projectPath, '.boilerstone/boilerplate.schema.json'))).toBe(true)
      expect(existsSync(join(projectPath, '.boilerstone/cli/boilerplate.ts'))).toBe(true)
      expect(existsSync(join(projectPath, '.boilerstone/docs/upgrade-runbook.md'))).toBe(true)

      expect(existsSync(join(projectPath, '.boilerstone/boilerplate.example.json'))).toBe(false)
      expect(existsSync(join(projectPath, '.boilerstone/migration-intentions'))).toBe(false)
      expect(existsSync(join(projectPath, '.boilerstone/legacy-checkpoints'))).toBe(false)
      expect(existsSync(join(projectPath, '.boilerstone/docs/ai-upgrades-implementation.md'))).toBe(false)
      expect(existsSync(join(projectPath, '.boilerstone/docs/pilot-rollout.md'))).toBe(false)
    }
    finally {
      logSpy.mockRestore()
      rmSync(projectPath, { recursive: true, force: true })
    }
  })
})
