import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  existsSync,
  rmSync,
  writeFileSync,
  copyFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  generateProject,
  PRODUCER_BLOCK_ROOTS,
  PRODUCER_FILES_TO_REMOVE,
  stripProducerOnlyBlocks,
  stripProducerOnlyBlocksFromText,
} from './generate'
import { isolatedGitEnv, runFileSync, spawnProcessSync } from './utils'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

// What can run in CI, ask for a check, or tell a person to do a producer-only
// step. `apps/documentation` is kept in every project and legitimately
// describes the boilerplate (release notes, the CLI map), so it is not scanned.
const SCANNED_ROOTS = ['.github', 'scripts', '.claude', '.cursor']
const PRODUCER_ONLY_STRINGS = [
  'Intention gate',
  'Intention promote',
  'no-intention',
  'intention-gate',
  'intention-promote',
  'boilerstone:producer-only',
]

function listFiles(rootPath: string, directory: string): string[] {
  const absolute = join(rootPath, directory)
  if (!existsSync(absolute)) {
    return []
  }
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? listFiles(rootPath, path) : [path]
  })
}

/** Files of this checkout, edits and new files included, as `git` would list them. */
function listCheckoutFiles(): string[] {
  const listed = runFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: projectRoot, env: isolatedGitEnv(), maxBuffer: 64 * 1024 * 1024 },
  )
  return [...new Set(listed.split('\0').filter(Boolean))].filter((file) =>
    existsSync(join(projectRoot, file)),
  )
}

describe('a project generated from this repository', () => {
  const generatedPath = mkdtempSync(join(tmpdir(), 'boilerstone-generated-'))
  const read = (path: string): string => readFileSync(join(generatedPath, path), 'utf-8')

  beforeAll(() => {
    for (const file of listCheckoutFiles()) {
      mkdirSync(dirname(join(generatedPath, file)), { recursive: true })
      copyFileSync(join(projectRoot, file), join(generatedPath, file))
    }
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    try {
      generateProject(generatedPath, { projectName: 'acme', sourceVersion: '1.2.3' })
    } finally {
      logSpy.mockRestore()
    }
  })

  afterAll(() => {
    rmSync(generatedPath, { recursive: true, force: true })
  })

  it('has none of the producer-only files', () => {
    for (const path of PRODUCER_FILES_TO_REMOVE) {
      expect(existsSync(join(generatedPath, path)), path).toBe(false)
    }
  })

  it('has neither intention workflow', () => {
    expect(existsSync(join(generatedPath, '.github/workflows/intention-gate.yml'))).toBe(false)
    expect(existsSync(join(generatedPath, '.github/workflows/intention-promote.yml'))).toBe(false)
  })

  it('never mentions a producer-only check, label or marker where it could run', () => {
    const offenders: string[] = []
    for (const file of SCANNED_ROOTS.flatMap((root) => listFiles(generatedPath, root))) {
      const text = read(file)
      for (const forbidden of PRODUCER_ONLY_STRINGS) {
        if (text.includes(forbidden)) {
          offenders.push(`${file}: ${forbidden}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it.skipIf(process.platform === 'win32')('keeps configure-github-repo.sh valid bash', () => {
    const result = spawnProcessSync(
      'bash',
      ['-n', join(generatedPath, 'scripts/configure-github-repo.sh')],
      {
        encoding: 'utf-8',
      },
    )
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
  })

  it('keeps the consumer parts of the shared script and doc', () => {
    expect(read('scripts/configure-github-repo.sh')).toContain('PR_TITLE')
    expect(read('scripts/configure-github-repo.sh')).toContain('environments/')
    expect(read('scripts/github-repo-settings.md')).toContain('`PR title and description`')
    expect(read('scripts/github-repo-settings.md')).toContain('`Release note`')
  })
})

describe('the boilerplate repository itself', () => {
  it('keeps every producer-only block', () => {
    const checkoutFiles = listCheckoutFiles()
    expect(checkoutFiles).toContain('.github/workflows/intention-gate.yml')
    expect(checkoutFiles).toContain('.github/workflows/intention-promote.yml')
    const script = readFileSync(join(projectRoot, 'scripts/configure-github-repo.sh'), 'utf-8')
    expect(script).toContain('no-intention')
    expect(script).toContain('boilerstone:producer-only:begin')
    const doc = readFileSync(join(projectRoot, 'scripts/github-repo-settings.md'), 'utf-8')
    expect(doc).toContain('`Intention gate`')
  })

  // The directory is the one definition of "this is the boilerplate repository"
  // (see "Producer or consumer" in .boilerstone/README.md). The strip list can
  // drift, so both workflows must skip on their own.
  it.each(['intention-gate.yml', 'intention-promote.yml'])(
    '%s skips successfully when migration-intentions/ is missing',
    (workflow) => {
      const text = readFileSync(join(projectRoot, '.github/workflows', workflow), 'utf-8')
      const checkout = text.indexOf('actions/checkout')
      const guard = text.indexOf('[ ! -d .boilerstone/migration-intentions ]')
      expect(checkout).toBeGreaterThan(-1)
      expect(guard).toBeGreaterThan(checkout)
      expect(text.slice(guard, guard + 400)).toContain('required=false')
      // The label logic must come after the guard, not before.
      expect(text.indexOf('autorelease: pending')).toBeGreaterThan(guard)
    },
  )
})

describe('producer-only blocks', () => {
  const begin = '# boilerstone:producer-only:begin'
  const end = '# boilerstone:producer-only:end'

  it('removes the marked lines and keeps the rest byte for byte', () => {
    const text = ['keep 1', begin, 'drop', 'drop too', end, 'keep 2', ''].join('\n')
    expect(stripProducerOnlyBlocksFromText(text, 'file')).toBe('keep 1\nkeep 2\n')
  })

  it('does not leave two blank lines where a block sat between blank lines', () => {
    const text = ['a', '', begin, 'drop', end, '', 'b'].join('\n')
    expect(stripProducerOnlyBlocksFromText(text, 'file')).toBe('a\n\nb')
  })

  it('works with HTML comment markers and several blocks', () => {
    const text = [
      'a',
      '<!-- boilerstone:producer-only:begin -->',
      'x',
      '<!-- boilerstone:producer-only:end -->',
      'b',
      '<!-- boilerstone:producer-only:begin -->',
      'y',
      '<!-- boilerstone:producer-only:end -->',
      'c',
    ].join('\n')
    expect(stripProducerOnlyBlocksFromText(text, 'file')).toBe('a\nb\nc')
  })

  it('leaves text without markers untouched', () => {
    expect(stripProducerOnlyBlocksFromText('a\r\nb\r\n', 'file')).toBe('a\r\nb\r\n')
  })

  it('refuses a block that is never closed, closed twice or nested', () => {
    expect(() => stripProducerOnlyBlocksFromText(`a\n${begin}\nb`, 'f.sh')).toThrow(
      /f\.sh.*never closed/,
    )
    expect(() => stripProducerOnlyBlocksFromText(`a\n${end}\nb`, 'f.sh')).toThrow(
      /f\.sh.*without a begin/,
    )
    expect(() => stripProducerOnlyBlocksFromText(`${begin}\n${begin}\n${end}`, 'f.sh')).toThrow(
      /f\.sh.*nested/,
    )
  })

  it('only rewrites files under the scanned roots', () => {
    const directory = mkdtempSync(join(tmpdir(), 'boilerstone-blocks-'))
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    try {
      mkdirSync(join(directory, PRODUCER_BLOCK_ROOTS[0]), { recursive: true })
      writeFileSync(join(directory, PRODUCER_BLOCK_ROOTS[0], 'a.yml'), `x\n${begin}\ny\n${end}\n`)
      mkdirSync(join(directory, 'apps'), { recursive: true })
      writeFileSync(join(directory, 'apps/b.txt'), `x\n${begin}\ny\n${end}\n`)

      stripProducerOnlyBlocks(directory)

      expect(readFileSync(join(directory, PRODUCER_BLOCK_ROOTS[0], 'a.yml'), 'utf-8')).toBe('x\n')
      expect(readFileSync(join(directory, 'apps/b.txt'), 'utf-8')).toContain(begin)
    } finally {
      logSpy.mockRestore()
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
