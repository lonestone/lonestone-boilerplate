import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from './utils'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const cliBin = join(projectRoot, '.boilerstone/cli/bin/lonestone.mjs')

function writeStub(binPath: string, name: string, source: string): void {
  const scriptPath = join(binPath, `${name}.cjs`)
  writeFileSync(scriptPath, source)
  if (isWindows) {
    writeFileSync(join(binPath, `${name}.cmd`), `@echo off\r\nnode "${scriptPath}" %*\r\n`)
    return
  }
  writeFileSync(join(binPath, name), source)
  chmodSync(join(binPath, name), 0o755)
}

function runInstaller(args: string[]): {
  status: number | null
  stderr: string
  commandLog: string
  cleanup: () => void
} {
  const fixturePath = mkdtempSync(join(tmpdir(), 'boilerstone-install-'))
  const binPath = join(fixturePath, 'bin')
  const commandLogPath = join(fixturePath, 'commands.log')
  mkdirSync(binPath)

  writeStub(
    binPath,
    'git',
    `#!/usr/bin/env node
const { appendFileSync, mkdirSync } = require('node:fs')
const args = process.argv.slice(2)
appendFileSync(process.env.COMMAND_LOG, \`git \${args.join(' ')}\\n\`)
if (args[0] === 'ls-remote') {
  process.stdout.write(
    [
      'dddddddddddddddddddddddddddddddddddddddd refs/tags/v2.0.0-beta.1',
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/v1.10.0',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/tags/v1.9.0',
      '',
    ].join('\\n'),
  )
  process.exit(0)
}
if (args[0] === 'clone') {
  mkdirSync(args.at(-1), { recursive: true })
  process.exit(0)
}
if (args[0] === '-C' && args[2] === 'rev-parse') {
  process.stdout.write('cccccccccccccccccccccccccccccccccccccccc\\n')
  process.exit(0)
}
if (args[0] === '-C' && args[2] === 'describe') {
  process.stdout.write('v1.10.0\\n')
  process.exit(0)
}
process.exit(0)
`,
  )
  writeStub(
    binPath,
    'pnpm',
    `#!/usr/bin/env node
const { appendFileSync } = require('node:fs')
appendFileSync(process.env.COMMAND_LOG, \`pnpm \${process.argv.slice(2).join(' ')}\\n\`)
process.exit(0)
`,
  )

  const result = spawnSync(process.execPath, [cliBin, ...args], {
    cwd: fixturePath,
    encoding: 'utf-8',
    env: {
      ...process.env,
      COMMAND_LOG: commandLogPath,
      PATH: `${binPath}${delimiter}${process.env.PATH ?? ''}`,
    },
  })

  return {
    status: result.status,
    stderr: result.stderr,
    commandLog: existsSync(commandLogPath) ? readFileSync(commandLogPath, 'utf-8') : '',
    cleanup: () => rmSync(fixturePath, { recursive: true, force: true }),
  }
}

describe('installer release references', () => {
  it.each([
    ['default', []],
    ['explicit latest', ['--ref', 'latest']],
  ])('resolves %s to the newest published SemVer tag', (_label, refArgs) => {
    const result = runInstaller(['init', 'app', ...refArgs])

    try {
      expect(result.status, result.stderr).toBe(0)
      expect(result.commandLog).toContain(
        'git ls-remote --tags --refs --sort=-version:refname https://github.com/lonestone/lonestone-boilerplate v*',
      )
      expect(result.commandLog).toContain(
        'git clone --quiet --depth 1 --branch v1.10.0 https://github.com/lonestone/lonestone-boilerplate app',
      )
    } finally {
      result.cleanup()
    }
  })

  it('keeps an explicit published release tag', () => {
    const result = runInstaller(['init', 'app', '--ref', 'v1.9.0'])

    try {
      expect(result.status, result.stderr).toBe(0)
      expect(result.commandLog).not.toContain('git ls-remote')
      expect(result.commandLog).toContain(
        'git clone --quiet --depth 1 --branch v1.9.0 https://github.com/lonestone/lonestone-boilerplate app',
      )
    } finally {
      result.cleanup()
    }
  })

  it('rejects branch references such as main', () => {
    const result = runInstaller(['init', 'app', '--ref', 'main'])

    try {
      expect(result.status).toBe(1)
      expect(result.stderr).toContain("--ref accepts only 'latest' or a release tag (vX.Y.Z)")
      expect(result.commandLog).not.toContain('git clone')
    } finally {
      result.cleanup()
    }
  })
})
