import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const hookConfigPath = join(projectRoot, 'lefthook.yml')

describe('lefthook.yml pre-push quality job', () => {
  const hookConfig = readFileSync(hookConfigPath, 'utf-8')

  it('does not drain git stdin, which hangs lefthook on a PTY', () => {
    expect(hookConfig).not.toMatch(/use_stdin\s*:/)
    expect(hookConfig).not.toContain('$(cat)')
  })

  it('does not run the Testcontainers test suite on push', () => {
    expect(hookConfig).not.toMatch(/pnpm test/)
  })

  it('still runs lint and typecheck with live output', () => {
    expect(hookConfig).toMatch(/follow:\s*true/)
    expect(hookConfig).toContain('pnpm lint')
    expect(hookConfig).toContain('pnpm typecheck')
  })
})
