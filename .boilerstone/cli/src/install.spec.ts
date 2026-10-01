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
  { env = {}, prepare }: { env?: NodeJS.ProcessEnv; prepare?: (fixturePath: string) => void } = {},
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
if (args[0] === 'rev-parse' && args[1] === '--git-dir') {
  // Not a git repository: onboard skips its interactive commit prompt.
  process.exit(128)
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

  prepare?.(fixturePath)
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

function getPnpmCalls(commandLog: string): string[] {
  return commandLog
    .split('\n')
    .filter((line) => line.startsWith('pnpm ') && line !== 'pnpm --version')
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

const cliVersion = (
  JSON.parse(readFileSync(join(projectRoot, '.boilerstone/cli/package.json'), 'utf-8')) as {
    version: string
  }
).version

function onboardCloneCommand(tag: string): RegExp {
  return new RegExp(
    `git clone --quiet --depth 1 --filter=blob:none --sparse --branch ${tag.replaceAll('.', '\\.')} https://github\\.com/lonestone/lonestone-boilerplate \\S+\\n`,
  )
}

// The fixture release is empty, so onboard stops right after cloning: enough
// to check which release it fetched.
const existingProject = (fixturePath: string): void => {
  writeFixtureFile(fixturePath, 'package.json', '{"name":"client-app"}\n')
}

describe('onboard release reference', () => {
  it.each([
    ['without --ref', []],
    ['with --ref naming the CLI version', ['--ref', `v${cliVersion}`]],
  ])('fetches the release matching the CLI version (%s)', (_label, refArgs) => {
    const result = runInstaller(['onboard', ...refArgs], { prepare: existingProject })

    try {
      expect(result.commandLog).not.toContain('git ls-remote')
      expect(result.commandLog).toMatch(onboardCloneCommand(`v${cliVersion}`))
      expect(result.stderr).toContain(`.boilerstone not found at ref v${cliVersion}`)
    } finally {
      result.cleanup()
    }
  })

  it.each([['v1.9.0'], ['latest'], ['main']])(
    'refuses --ref %s and points to the matching CLI',
    (ref) => {
      const result = runInstaller(['onboard', '--ref', ref], { prepare: existingProject })

      try {
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('This CLI only works with its own release')
        expect(result.stderr).toContain(`pnpm dlx @lonestone/cli@${ref.replace(/^v/, '')} onboard`)
        expect(result.commandLog).not.toContain('git clone')
      } finally {
        result.cleanup()
      }
    },
  )
})

/** What onboard's sparse clone brings in from a release. */
function createOnboardRelease(): string {
  const releasePath = mkdtempSync(join(tmpdir(), 'boilerstone-release-'))
  writeFixtureFile(releasePath, '.boilerstone/docs/upgrade-runbook.md', '# Runbook')
  writeFixtureFile(releasePath, '.boilerstone/migration-intentions/TEMPLATE.md', '# Template')
  writeFixtureFile(releasePath, '.claude/skills/boilerstone-upgrade/SKILL.md', '# Upgrade')
  writeFixtureFile(releasePath, '.cursor/skills/boilerstone-upgrade/SKILL.md', '# Upgrade')
  return releasePath
}

describe('onboard lockfile refresh', () => {
  it.each([
    {
      label: 'leaves the lockfile alone when bootstrap keeps the workspace',
      workspace: 'packages:\n  - apps/*\n',
      pnpmCalls: [] as string[],
    },
    {
      label: 'refreshes the lockfile when bootstrap drops a .boilerstone workspace entry',
      workspace: 'packages:\n  - apps/*\n  - .boilerstone\n',
      pnpmCalls: ['pnpm install'],
    },
  ])('$label', ({ workspace, pnpmCalls }) => {
    const releasePath = createOnboardRelease()
    const result = runInstaller(['onboard'], {
      env: { TEMPLATE_FIXTURE: releasePath, BOILERPLATE_SOURCE_VERSION: '1.0.0' },
      prepare: (fixturePath) => {
        writeFixtureFile(fixturePath, 'package.json', '{"name":"client-app"}\n')
        writeFixtureFile(fixturePath, 'pnpm-workspace.yaml', workspace)
      },
    })

    try {
      expect(result.status, result.stderr).toBe(0)
      expect(existsSync(join(result.fixturePath, '.boilerstone/boilerplate.json'))).toBe(true)
      expect(getPnpmCalls(result.commandLog)).toEqual(pnpmCalls)
    } finally {
      result.cleanup()
      rmSync(releasePath, { recursive: true, force: true })
    }
  })
})

describe('init project generation', () => {
  it.each([
    ['without --ref', []],
    ['with --ref naming the CLI version', ['--ref', `v${cliVersion}`]],
  ])('generates the release matching the CLI version (%s)', (_label, refArgs) => {
    const templatePath = createPublishedCliTemplate()
    const result = runInstaller(['init', 'app', ...refArgs], {
      env: { TEMPLATE_FIXTURE: templatePath },
    })
    const appPath = join(result.fixturePath, 'app')

    try {
      expect(result.status, result.stderr).toBe(0)
      expect(result.commandLog).not.toContain('git ls-remote')
      expect(result.commandLog).toMatch(cloneCommand(`v${cliVersion}`))

      const pkg = JSON.parse(readFileSync(join(appPath, 'package.json'), 'utf-8'))
      expect(pkg.name).toBe('app')
      // The project runs the CLI through pnpm dlx and never installs it;
      // rock stays on the release that generated the project.
      expect(pkg.scripts.rock).toBe(`pnpm dlx @lonestone/cli@${cliVersion} rock`)
      expect(pkg.scripts.boilerplate).toBe('pnpm dlx @lonestone/cli@latest')
      expect(pkg.devDependencies['@lonestone/cli']).toBeUndefined()
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
      ).toBe(cliVersion)

      expect(getPnpmCalls(result.commandLog)).toEqual(['pnpm install', 'pnpm fmt', 'pnpm rock'])
      expect(leftoverStagingDirs(result.fixturePath)).toEqual([])
    } finally {
      result.cleanup()
      rmSync(templatePath, { recursive: true, force: true })
    }
  })

  it('refuses another release and points to the matching CLI', () => {
    const result = runInstaller(['init', 'app', '--ref', 'v1.9.0'])

    try {
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('This CLI only works with its own release')
      expect(result.stderr).toContain('pnpm dlx @lonestone/cli@1.9.0 init app')
      expect(result.commandLog).not.toContain('git clone')
    } finally {
      result.cleanup()
    }
  })

  it('refuses a release that does not use the published CLI, leaving nothing behind', () => {
    // An empty clone: no package.json, so no `lonestone rock` script.
    const result = runInstaller(['init', 'app'])

    try {
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('is not a template for @lonestone/cli')
      expect(existsSync(join(result.fixturePath, 'app'))).toBe(false)
      expect(leftoverStagingDirs(result.fixturePath)).toEqual([])
      expect(result.commandLog).not.toContain('pnpm install')
    } finally {
      result.cleanup()
    }
  })

  it('rejects a directory name that cannot be a package scope before cloning', () => {
    const result = runInstaller(['init', 'My_App'])

    try {
      expect(result.status).toBe(1)
      expect(result.stderr).toContain("'My_App' is not a valid project name")
      expect(existsSync(join(result.fixturePath, 'My_App'))).toBe(false)
      expect(result.commandLog).not.toContain('git clone')
    } finally {
      result.cleanup()
    }
  })
})
