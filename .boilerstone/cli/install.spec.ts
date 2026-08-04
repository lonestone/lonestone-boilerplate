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
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const installerPath = join(projectRoot, 'install.sh')

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

  writeFileSync(
    join(binPath, 'git'),
    `#!/bin/sh
printf 'git %s\n' "$*" >> "$COMMAND_LOG"
if [ "$1" = "ls-remote" ]; then
  printf '%s\n' \
    'dddddddddddddddddddddddddddddddddddddddd refs/tags/v2.0.0-beta.1' \
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb refs/tags/v1.10.0' \
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/tags/v1.9.0'
  exit 0
fi
if [ "$1" = "clone" ]; then
  for target do :; done
  mkdir -p "$target"
  exit 0
fi
if [ "$1" = "-C" ] && [ "$3" = "rev-parse" ]; then
  printf '%s\n' 'cccccccccccccccccccccccccccccccccccccccc'
  exit 0
fi
if [ "$1" = "-C" ] && [ "$3" = "describe" ]; then
  printf '%s\n' 'v1.10.0'
  exit 0
fi
exit 0
`,
  )
  writeFileSync(
    join(binPath, 'pnpm'),
    `#!/bin/sh
printf 'pnpm %s\n' "$*" >> "$COMMAND_LOG"
exit 0
`,
  )
  chmodSync(join(binPath, 'git'), 0o755)
  chmodSync(join(binPath, 'pnpm'), 0o755)

  const result = spawnSync('sh', [installerPath, ...args], {
    cwd: fixturePath,
    encoding: 'utf-8',
    env: {
      ...process.env,
      COMMAND_LOG: commandLogPath,
      PATH: `${binPath}:${process.env.PATH}`,
    },
  })

  return {
    status: result.status,
    stderr: result.stderr,
    commandLog: existsSync(commandLogPath) ? readFileSync(commandLogPath, 'utf-8') : '',
    cleanup: () => rmSync(fixturePath, { recursive: true, force: true }),
  }
}

describe('install.sh release references', () => {
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
