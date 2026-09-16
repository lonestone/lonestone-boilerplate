import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { canReadTty, isolatedGitEnv, movePath, spawnProcessSync } from './utils'

const fixtures: string[] = []

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true })
  }
})

describe('movePath', () => {
  it('moves a directory to the destination', () => {
    const rootPath = mkdtempSync(join(tmpdir(), 'move-path-'))
    fixtures.push(rootPath)
    const source = join(rootPath, 'from')
    const destination = join(rootPath, 'to')
    mkdirSync(source)
    writeFileSync(join(source, 'file.txt'), 'ok\n')

    movePath(source, destination)

    expect(readFileSync(join(destination, 'file.txt'), 'utf-8')).toBe('ok\n')
  })
})

describe('canReadTty', () => {
  it('does not throw on this platform', () => {
    expect(typeof canReadTty()).toBe('boolean')
  })
})

describe('spawnProcessSync git', () => {
  it('keeps multi-word commit messages intact', () => {
    const rootPath = mkdtempSync(join(tmpdir(), 'git-commit-message-'))
    fixtures.push(rootPath)
    const env = isolatedGitEnv()

    spawnProcessSync('git', ['init'], { cwd: rootPath, encoding: 'utf-8', env })
    spawnProcessSync('git', ['config', 'user.email', 'test@example.com'], {
      cwd: rootPath,
      encoding: 'utf-8',
      env,
    })
    spawnProcessSync('git', ['config', 'user.name', 'Test'], {
      cwd: rootPath,
      encoding: 'utf-8',
      env,
    })
    writeFileSync(join(rootPath, 'file.txt'), 'ok\n')
    spawnProcessSync('git', ['add', 'file.txt'], { cwd: rootPath, encoding: 'utf-8', env })
    spawnProcessSync('git', ['commit', '-m', 'consumer project'], {
      cwd: rootPath,
      encoding: 'utf-8',
      env,
    })

    const log = spawnProcessSync('git', ['log', '-1', '--format=%s'], {
      cwd: rootPath,
      encoding: 'utf-8',
      env,
    })

    expect(log.stdout?.toString().trim()).toBe('consumer project')
  })
})
