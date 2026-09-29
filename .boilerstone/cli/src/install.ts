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
  getPublishedCliRange,
  isolatedGitEnv,
  movePath,
  runFileSync,
  spawnProcessSync,
} from './utils.js'

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
    die(
      "--ref accepts only 'latest' or a release tag (vX.Y.Z); branches such as main are not supported",
    )
  }
}

function resolveReleaseRef(repoUrl: string, ref: string): string {
  if (ref !== 'latest') {
    return ref
  }

  const output = runFileSync(
    'git',
    ['ls-remote', '--tags', '--refs', '--sort=-version:refname', repoUrl, 'v*'],
    { env: gitEnv() },
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

interface StagedProject {
  isGenerated: boolean
  sourceCommit: string
  sourceVersion: string
}

/**
 * Clone the release into a sibling staging directory, generate the project
 * there, then move it into place. The CLI runs from outside the project it
 * builds, and a failure leaves nothing behind at `dir`.
 */
function stageProject(repoUrl: string, ref: string, dir: string): StagedProject {
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
    const sourceVersion = ref.replace(/^v/, '')
    rmSync(join(staging, '.git'), { recursive: true, force: true })

    // Releases that still vendor their setup script generate themselves
    // through their own `pnpm rock`.
    const isGenerated = isPublishedCliTemplate(staging)
    if (isGenerated) {
      const projectName = basename(dir)
      if (!isValidProjectName(projectName)) {
        throw new Error(
          `'${projectName}' is not a valid project name: use lowercase letters, digits and dashes`,
        )
      }
      generateProject(staging, {
        projectName,
        cliRange: getPublishedCliRange(),
        sourceVersion,
        sourceCommit: sourceCommit || undefined,
        remote: process.env.BOILERPLATE_REPO?.trim() || undefined,
      })
    }

    movePath(staging, dir)
    return { isGenerated, sourceCommit, sourceVersion }
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
    const dirInput = options.positionals[0] || 'my-app'
    const dir = resolve(cwd, dirInput)
    if (existsSync(dir)) {
      die(`Directory '${dirInput}' already exists`)
    }
    info(`Creating new project in ${dir} from ${repoUrl}@${ref}`)
    const staged = stageProject(repoUrl, ref, dir)

    runGit(['init', '--quiet'], dir)
    runPnpm(['install'], dir)
    if (staged.isGenerated) {
      // The scope rename can reorder imports; the generated project must lint clean.
      if (!tryRunPnpm(['lint:fix'], dir)) {
        info('pnpm lint:fix failed — run it yourself before the first commit')
      }
      runPnpm(['rock'], dir)
    } else {
      runPnpm(['rock'], dir, {
        BOILERPLATE_SOURCE_COMMIT: staged.sourceCommit,
        BOILERPLATE_SOURCE_VERSION: staged.sourceVersion,
      })
    }
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
