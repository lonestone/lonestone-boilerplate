import { execFileSync, spawnSync } from 'node:child_process'
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  renameSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { bootstrapProject } from './boilerplate'
import { colorize, isolatedGitEnv } from './utils'

const defaultBoilerplateRemote = 'https://github.com/lonestone/lonestone-boilerplate'

interface InstallerOptions {
  mode: string
  ref: string
  positionals: string[]
}

function info(message: string): void {
  console.log(`${colorize('→', 'cyan')} ${message}`)
}

function ok(message: string): void {
  console.log(`${colorize('✓', 'green')} ${message}`)
}

function die(message: string): never {
  console.error(`${colorize('✗', 'red')} ${message}`)
  process.exit(1)
}

function need(command: string): void {
  const result = spawnSync(command, ['--version'], { encoding: 'utf-8' })
  if (result.status !== 0 && result.error) {
    die(`Required command not found: ${command}`)
  }
}

function gitEnv(): NodeJS.ProcessEnv {
  return isolatedGitEnv()
}

function runGit(args: string[], cwd?: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    env: gitEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function runPnpm(args: string[], cwd: string, env: NodeJS.ProcessEnv = {}): void {
  const result = spawnSync('pnpm', args, {
    cwd,
    env: { ...gitEnv(), ...env },
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    die(`pnpm ${args.join(' ')} failed`)
  }
}

function parseArgs(argv: string[]): InstallerOptions {
  const [mode = 'help', ...rest] = argv
  let ref = 'latest'
  const positionals: string[] = []

  for (let index = 0; index < rest.length; index += 1) {
    const current = rest[index]
    if (current === '--ref') {
      const value = rest[index + 1]
      if (!value) {
        die('--ref requires a value')
      }
      ref = value
      index += 1
      continue
    }
    if (current.startsWith('--ref=')) {
      ref = current.slice('--ref='.length)
      continue
    }
    if (current === '-h' || current === '--help') {
      return { mode: 'help', ref, positionals }
    }
    if (current.startsWith('--')) {
      die(`Unknown option: ${current}`)
    }
    positionals.push(current)
  }

  return { mode, ref, positionals }
}

function validateReleaseRef(ref: string): void {
  if (ref === 'latest') {
    return
  }
  if (!/^v\d+\.\d+\.\d+$/.test(ref)) {
    die("--ref accepts only 'latest' or a release tag (vX.Y.Z); branches such as main are not supported")
  }
}

function resolveReleaseRef(repoUrl: string, ref: string): string {
  if (ref !== 'latest') {
    return ref
  }

  const output = execFileSync(
    'git',
    ['ls-remote', '--tags', '--refs', '--sort=-version:refname', repoUrl, 'v*'],
    { encoding: 'utf-8', env: gitEnv() },
  )
  const tag = output
    .split('\n')
    .map((line) => line.replace(/.*refs\/tags\//, '').trim())
    .find((candidate) => /^v\d+\.\d+\.\d+$/.test(candidate))

  if (!tag) {
    die(`No published boilerplate release found at ${repoUrl}`)
  }
  info(`Resolved latest release: ${tag}`)
  return tag
}

function canReadTty(): boolean {
  try {
    const fd = openSync('/dev/tty', 'r')
    closeSync(fd)
    return true
  } catch {
    return false
  }
}

async function promptYesNo(message: string, defaultYes: boolean): Promise<boolean> {
  if (!canReadTty()) {
    return defaultYes
  }
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  try {
    const hint = defaultYes ? '[Y/n]' : '[y/N]'
    const answer = await rl.question(`${colorize('→', 'cyan')} ${message} ${hint} `)
    const normalized = answer.trim().toLowerCase()
    if (!normalized) {
      return defaultYes
    }
    return normalized.startsWith('y')
  } finally {
    rl.close()
  }
}

function fetchSubdirs(repoUrl: string, ref: string, subdirs: string[], cwd: string): void {
  for (const subdir of subdirs) {
    if (existsSync(join(cwd, subdir))) {
      die(`${subdir} already exists here — remove it first`)
    }
  }

  const tmp = mkdtempSync(join(tmpdir(), 'lonestone-fetch-'))
  try {
    info(`Fetching ${subdirs.join(' ')} from ${repoUrl}@${ref}`)
    runGit(
      ['clone', '--quiet', '--depth', '1', '--filter=blob:none', '--sparse', '--branch', ref, repoUrl, tmp],
    )
    runGit(['sparse-checkout', 'set', ...subdirs], tmp)
    for (const subdir of subdirs) {
      const source = join(tmp, subdir)
      if (!existsSync(source)) {
        die(`${subdir} not found at ref ${ref}`)
      }
      const destination = join(cwd, subdir)
      mkdirSync(dirname(destination), { recursive: true })
      renameSync(source, destination)
      ok(`Fetched ${subdir}`)
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('clone')) {
      die(`git clone failed (ref: ${ref})`)
    }
    throw error
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

async function offerOnboardCommit(cwd: string): Promise<void> {
  try {
    runGit(['rev-parse', '--git-dir'], cwd)
  } catch {
    info('Not a git repository — skipping commit')
    return
  }

  const shouldCommit = await promptYesNo('Commit the onboarding now?', true)
  if (!shouldCommit) {
    info(
      'Skipped — review and commit .boilerstone/, the boilerstone-upgrade skills, package.json and .gitignore yourself',
    )
    return
  }

  spawnSync(
    'git',
    [
      'add',
      '.boilerstone',
      '.claude/skills/boilerstone-upgrade',
      '.cursor/skills/boilerstone-upgrade',
      'package.json',
      '.gitignore',
      'pnpm-lock.yaml',
    ],
    { cwd, env: gitEnv(), stdio: 'ignore' },
  )

  const staged = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd, env: gitEnv() })
  if (staged.status === 0) {
    info('Nothing to commit')
    return
  }

  const commit = spawnSync(
    'git',
    ['commit', '--quiet', '-m', 'chore: onboard boilerstone upgrade tracking'],
    { cwd, env: gitEnv(), stdio: 'inherit' },
  )
  if (commit.status === 0) {
    ok('Committed the onboarding')
    return
  }

  info('Commit was rejected (pre-commit hooks?). The onboarding files are staged.')
  const bypass = await promptYesNo('Retry with --no-verify?', false)
  if (!bypass) {
    info(
      'Left staged — fix the hook failures or run: git commit --no-verify -m "chore: onboard boilerstone upgrade tracking"',
    )
    return
  }

  const retry = spawnSync(
    'git',
    ['commit', '--quiet', '--no-verify', '-m', 'chore: onboard boilerstone upgrade tracking'],
    { cwd, env: gitEnv(), stdio: 'inherit' },
  )
  if (retry.status !== 0) {
    die('git commit failed')
  }
  ok('Committed the onboarding (hooks bypassed)')
}

export function printInstallerUsage(): void {
  console.log(`
Lonestone boilerplate installer

Usage:
  curl -fsSL https://raw.githubusercontent.com/lonestone/lonestone-boilerplate/main/install.sh | sh -s -- <command> [args]
  pnpm dlx @lonestone/cli <command> [args]

Commands:
  init [dir]          Create a new project from the template (default dir: my-app)
  onboard             Add the upgrade system + agent skills to an existing project (run at its root)
  upgrade [version]   Prepare a boilerplate upgrade in an already-wired project (default: latest)

Options:
  --ref <latest|tag>  Published release to fetch (default: latest; tag format: vX.Y.Z)

Environment:
  BOILERPLATE_REPO    Override the repository URL (e.g. an SSH URL for a private fork)
`)
}

export async function runInstaller(argv: string[]): Promise<void> {
  const options = parseArgs(argv)
  const repoUrl = process.env.BOILERPLATE_REPO?.trim() || defaultBoilerplateRemote
  const cwd = process.cwd()

  if (options.mode === 'help' || options.mode === '-h' || options.mode === '--help') {
    printInstallerUsage()
    return
  }

  validateReleaseRef(options.ref)

  if (options.mode === 'init') {
    if (options.positionals.length > 1) {
      die('init accepts at most one directory argument')
    }
    need('git')
    need('pnpm')
    const ref = resolveReleaseRef(repoUrl, options.ref)
    const dir = resolve(cwd, options.positionals[0] || 'my-app')
    if (existsSync(dir)) {
      die(`Directory '${options.positionals[0] || 'my-app'}' already exists`)
    }
    info(`Creating new project in ${dir} from ${repoUrl}@${ref}`)
    try {
      runGit(['clone', '--quiet', '--depth', '1', '--branch', ref, repoUrl, dir])
    } catch {
      die(`git clone failed (ref: ${ref})`)
    }

    let sourceCommit = ''
    let sourceVersion = ''
    try {
      sourceCommit = runGit(['rev-parse', 'HEAD'], dir)
    } catch {
      sourceCommit = ''
    }
    try {
      sourceVersion = runGit(
        ['describe', '--tags', '--exact-match', '--match', 'v*'],
        dir,
      )
    } catch {
      try {
        sourceVersion = runGit(['describe', '--tags', '--abbrev=0', '--match', 'v*'], dir)
      } catch {
        sourceVersion = ''
      }
    }
    sourceVersion = sourceVersion.replace(/^v/, '')

    rmSync(join(dir, '.git'), { recursive: true, force: true })
    runGit(['init', '--quiet'], dir)
    runPnpm(['install'], dir)
    runPnpm(['rock'], dir, {
      BOILERPLATE_SOURCE_COMMIT: sourceCommit,
      BOILERPLATE_SOURCE_VERSION: sourceVersion,
    })
    ok(`Project ready in ${dir}`)
    return
  }

  if (options.mode === 'onboard') {
    if (options.positionals.length > 0) {
      die('onboard does not accept positional arguments')
    }
    need('git')
    need('pnpm')
    const ref = resolveReleaseRef(repoUrl, options.ref)
    if (!existsSync(join(cwd, 'package.json'))) {
      die('Run this at the root of an existing project (package.json not found)')
    }
    fetchSubdirs(
      repoUrl,
      ref,
      ['.boilerstone', '.claude/skills/boilerstone-upgrade', '.cursor/skills/boilerstone-upgrade'],
      cwd,
    )
    rmSync(join(cwd, '.boilerstone/boilerplate.json'), { force: true })
    process.env.BOILERPLATE_INSTALLER_ONBOARD = '1'
    await bootstrapProject(cwd)
    runPnpm(['install'], cwd)
    await offerOnboardCommit(cwd)
    ok('Project onboarded')
    return
  }

  die(`Unknown command: ${options.mode}`)
}
