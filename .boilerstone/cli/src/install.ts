import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { bootstrapProject } from './boilerplate.js'
import { generateProject, isPublishedCliTemplate, isValidProjectName } from './generate.js'
import {
  canReadTty,
  colorize,
  getCliVersion,
  getPublishedCliRange,
  isolatedGitEnv,
  movePath,
  runFileSync,
  spawnProcessSync,
} from './utils.js'

const defaultBoilerplateRemote = 'https://github.com/lonestone/lonestone-boilerplate'

interface InstallerOptions {
  mode: string
  /** Undefined when `--ref` was not passed. */
  ref?: string
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
  const result = spawnProcessSync(command, ['--version'], { encoding: 'utf-8' })
  if (result.error || result.status !== 0) {
    die(`Required command not found: ${command}`)
  }
}

function gitEnv(): NodeJS.ProcessEnv {
  return isolatedGitEnv()
}

function runGit(args: string[], cwd?: string): string {
  return runFileSync('git', args, {
    cwd,
    env: gitEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function tryRunPnpm(args: string[], cwd: string, env: NodeJS.ProcessEnv = {}): boolean {
  const result = spawnProcessSync('pnpm', args, {
    cwd,
    env: { ...gitEnv(), ...env },
    stdio: 'inherit',
  })
  return result.status === 0
}

function runPnpm(args: string[], cwd: string, env: NodeJS.ProcessEnv = {}): void {
  if (!tryRunPnpm(args, cwd, env)) {
    die(`pnpm ${args.join(' ')} failed`)
  }
}

function cloneRelease(
  repoUrl: string,
  ref: string,
  target: string,
  extraArgs: string[] = [],
): void {
  try {
    runGit(['clone', '--quiet', '--depth', '1', ...extraArgs, '--branch', ref, repoUrl, target])
  } catch {
    throw new Error(`git clone failed (ref: ${ref})`)
  }
}

function parseArgs(argv: string[]): InstallerOptions {
  const [mode = 'help', ...rest] = argv
  let ref: string | undefined
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

/**
 * The release a CLI works with is the one carrying its own version: it only
 * knows that release's layout. Pinning a release means pinning the CLI, so
 * `--ref` is accepted only when it names that same release.
 */
function getCliReleaseRef(requestedRef: string | undefined, retryCommand: string): string {
  const ref = `v${getCliVersion()}`
  if (requestedRef !== undefined && requestedRef !== ref) {
    die(
      `This CLI only works with its own release (${ref}). For ${requestedRef}, run: pnpm dlx @lonestone/cli@${requestedRef.replace(/^v/, '')} ${retryCommand}`,
    )
  }
  return ref
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
    cloneRelease(repoUrl, ref, tmp, ['--filter=blob:none', '--sparse'])
    runGit(['sparse-checkout', 'set', ...subdirs], tmp)
    for (const subdir of subdirs) {
      const source = join(tmp, subdir)
      if (!existsSync(source)) {
        throw new Error(`${subdir} not found at ref ${ref}`)
      }
      const destination = join(cwd, subdir)
      mkdirSync(dirname(destination), { recursive: true })
      movePath(source, destination)
      ok(`Fetched ${subdir}`)
    }
  } catch (error) {
    // die() exits the process, so clean up before calling it.
    rmSync(tmp, { recursive: true, force: true })
    die(error instanceof Error ? error.message : String(error))
  }
  rmSync(tmp, { recursive: true, force: true })
}

/**
 * Clone the release into a sibling staging directory, generate the project
 * there, then move it into place. The CLI runs from outside the project it
 * builds, and a failure leaves nothing behind at `dir`.
 */
function stageProject(repoUrl: string, ref: string, dir: string): void {
  const projectName = basename(dir)
  if (!isValidProjectName(projectName)) {
    die(`'${projectName}' is not a valid project name: use lowercase letters, digits and dashes`)
  }

  mkdirSync(dirname(dir), { recursive: true })
  const staging = mkdtempSync(join(dirname(dir), '.lonestone-init-'))
  try {
    cloneRelease(repoUrl, ref, staging)
    let sourceCommit = ''
    try {
      sourceCommit = runGit(['rev-parse', 'HEAD'], staging)
    } catch {
      sourceCommit = ''
    }
    rmSync(join(staging, '.git'), { recursive: true, force: true })

    if (!isPublishedCliTemplate(staging)) {
      throw new Error(
        `${ref} at ${repoUrl} is not a template for @lonestone/cli: its pnpm rock does not run the published CLI`,
      )
    }
    generateProject(staging, {
      projectName,
      cliRange: getPublishedCliRange(),
      sourceVersion: ref.replace(/^v/, ''),
      sourceCommit: sourceCommit || undefined,
      remote: process.env.BOILERPLATE_REPO?.trim() || undefined,
    })

    movePath(staging, dir)
  } catch (error) {
    // die() exits the process, so clean up before calling it.
    rmSync(staging, { recursive: true, force: true })
    die(error instanceof Error ? error.message : String(error))
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

  spawnProcessSync(
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

  const staged = spawnProcessSync('git', ['diff', '--cached', '--quiet'], { cwd, env: gitEnv() })
  if (staged.status === 0) {
    info('Nothing to commit')
    return
  }

  const commit = spawnProcessSync(
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

  const retry = spawnProcessSync(
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
  pnpm dlx @lonestone/cli <command> [args]

Commands:
  init [dir]          Create a new project from the release matching this CLI (default dir: my-app)
  onboard             Add the upgrade system + agent skills to an existing project (run at its root)
  upgrade [version]   Prepare a boilerplate upgrade in an already-wired project (default: latest)

init and onboard use the release that has this CLI's version. Pin a release by
pinning the CLI: pnpm dlx @lonestone/cli@1.2.0 init my-app

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

  if (options.mode === 'init') {
    if (options.positionals.length > 1) {
      die('init accepts at most one directory argument')
    }
    const dirInput = options.positionals[0] || 'my-app'
    const ref = getCliReleaseRef(options.ref, `init ${dirInput}`)
    need('git')
    need('pnpm')
    const dir = resolve(cwd, dirInput)
    if (existsSync(dir)) {
      die(`Directory '${dirInput}' already exists`)
    }
    info(`Creating new project in ${dir} from ${repoUrl}@${ref}`)
    stageProject(repoUrl, ref, dir)

    runGit(['init', '--quiet'], dir)
    runPnpm(['install'], dir)
    // The scope rename can reorder imports; the generated project must lint clean.
    if (!tryRunPnpm(['lint:fix'], dir)) {
      info('pnpm lint:fix failed — run it yourself before the first commit')
    }
    runPnpm(['rock'], dir)
    ok(`Project ready in ${dir}`)
    return
  }

  if (options.mode === 'onboard') {
    if (options.positionals.length > 0) {
      die('onboard does not accept positional arguments')
    }
    const ref = getCliReleaseRef(options.ref, 'onboard')
    need('git')
    need('pnpm')
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
