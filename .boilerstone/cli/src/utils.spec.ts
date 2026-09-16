import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { canReadTty, movePath } from './utils'

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
