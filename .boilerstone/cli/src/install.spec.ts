import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
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

function isolatedTestPath(binPath: string): string {
  const filtered = (process.env.PATH ?? '')
    .split(delimiter)
    .filter((entry) => !/[\\/]git[\\/]/i.test(entry))
  return `${binPath}${delimiter}${filtered.join(delimiter)}`
}

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

function runInstaller(
  args: string[],
  env: NodeJS.ProcessEnv = {},
): {
  status: number | null
  stderr: string
  commandLog: string
  fixturePath: string
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
const { appendFileSync, cpSync, mkdirSync } = require('node:fs')
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
  if (process.env.TEMPLATE_FIXTURE) {
    cpSync(process.env.TEMPLATE_FIXTURE, args.at(-1), { recursive: true })
  }
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
      PATH: isolatedTestPath(binPath),
      ...env,
    },
  })

  return {
    status: result.status,
    stderr: result.stderr,
    commandLog: existsSync(commandLogPath) ? readFileSync(commandLogPath, 'utf-8') : '',
    fixturePath,
    cleanup: () => rmSync(fixturePath, { recursive: true, force: true }),
  }
}

function cloneCommand(tag: string): RegExp {
  return new RegExp(
    `git clone --quiet --depth 1 --branch ${tag.replaceAll('.', '\\.')} https://github\\.com/lonestone/lonestone-boilerplate \\S*\\.lonestone-init-\\S+\\n`,
  )
}

function writeFixtureFile(rootPath: string, filePath: string, content: string): void {
  mkdirSync(dirname(join(rootPath, filePath)), { recursive: true })
  writeFileSync(join(rootPath, filePath), content)
}

/** Minimal release checkout whose `pnpm rock` runs the published CLI. */
function createPublishedCliTemplate(): string {
  const templatePath = mkdtempSync(join(tmpdir(), 'boilerstone-template-'))
  writeFixtureFile(
    templatePath,
    'package.json',
    `${JSON.stringify({
      name: 'boilerstone',
      scripts: { rock: 'lonestone rock', boilerplate: 'lonestone' },
      devDependencies: { '@lonestone/cli': 'workspace:*' },
    })}\n`,
  )
  writeFixtureFile(templatePath, 'apps/api/package.json', '{"name":"@boilerstone/api"}\n')
  writeFixtureFile(
    templatePath,
    'pnpm-workspace.yaml',
    'packages:\n  - apps/*\n  - .boilerstone/cli\n',
  )
  writeFixtureFile(templatePath, '.boilerstone/cli/package.json', '{"name":"@lonestone/cli"}\n')
  writeFixtureFile(templatePath, '.boilerstone/migration-intentions/TEMPLATE.md', '# Template')
  writeFixtureFile(templatePath, '.boilerstone/docs/upgrade-runbook.md', '# Runbook')
  return templatePath
}

function leftoverStagingDirs(fixturePath: string): string[] {
  return readdirSync(fixturePath).filter((entry) => entry.startsWith('.lonestone-init-'))
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
      expect(result.commandLog).toMatch(cloneCommand('v1.10.0'))
    } finally {
      result.cleanup()
    }
  })

  it('keeps an explicit published release tag', () => {
    const result = runInstaller(['init', 'app', '--ref', 'v1.9.0'])

    try {
      expect(result.status, result.stderr).toBe(0)
      expect(result.commandLog).not.toContain('git ls-remote')
      expect(result.commandLog).toMatch(cloneCommand('v1.9.0'))
      expect(existsSync(join(result.fixturePath, 'app'))).toBe(true)
      expect(leftoverStagingDirs(result.fixturePath)).toEqual([])
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

describe('installer project generation', () => {
  const cliVersion = (
    JSON.parse(readFileSync(join(projectRoot, '.boilerstone/cli/package.json'), 'utf-8')) as {
      version: string
    }
  ).version

  it('generates the project before running the dev setup', () => {
    const templatePath = createPublishedCliTemplate()
    const result = runInstaller(['init', 'app', '--ref', 'v1.9.0'], {
      TEMPLATE_FIXTURE: templatePath,
    })
    const appPath = join(result.fixturePath, 'app')

    try {
      expect(result.status, result.stderr).toBe(0)

      const pkg = JSON.parse(readFileSync(join(appPath, 'package.json'), 'utf-8'))
      expect(pkg.name).toBe('app')
      expect(pkg.scripts.rock).toBe('lonestone rock')
      // Pinned to the CLI that generated the project, never the workspace copy.
      expect(pkg.devDependencies['@lonestone/cli']).toBe(`^${cliVersion}`)
      expect(JSON.parse(readFileSync(join(appPath, 'apps/api/package.json'), 'utf-8')).name).toBe(
        '@app/api',
      )
      expect(readFileSync(join(appPath, 'pnpm-workspace.yaml'), 'utf-8')).not.toContain(
        '.boilerstone/cli',
      )
      expect(existsSync(join(appPath, '.boilerstone/cli'))).toBe(false)
      expect(existsSync(join(appPath, '.boilerstone/migration-intentions'))).toBe(false)
      expect(existsSync(join(appPath, '.boilerstone/docs/upgrade-runbook.md'))).toBe(true)
      expect(
        JSON.parse(readFileSync(join(appPath, '.boilerstone/boilerplate.json'), 'utf-8')).source
          .currentVersion,
      ).toBe('1.9.0')

      const pnpmCalls = result.commandLog
        .split('\n')
        .filter((line) => line.startsWith('pnpm ') && line !== 'pnpm --version')
      expect(pnpmCalls).toEqual(['pnpm install', 'pnpm lint:fix', 'pnpm rock'])
      expect(leftoverStagingDirs(result.fixturePath)).toEqual([])
    } finally {
      result.cleanup()
      rmSync(templatePath, { recursive: true, force: true })
    }
  })

  it('rejects a directory name that cannot be a package scope, leaving nothing behind', () => {
    const templatePath = createPublishedCliTemplate()
    const result = runInstaller(['init', 'My_App', '--ref', 'v1.9.0'], {
      TEMPLATE_FIXTURE: templatePath,
    })

    try {
      expect(result.status).toBe(1)
      expect(result.stderr).toContain("'My_App' is not a valid project name")
      expect(existsSync(join(result.fixturePath, 'My_App'))).toBe(false)
      expect(leftoverStagingDirs(result.fixturePath)).toEqual([])
      expect(result.commandLog).not.toContain('pnpm install')
    } finally {
      result.cleanup()
      rmSync(templatePath, { recursive: true, force: true })
    }
  })
})
