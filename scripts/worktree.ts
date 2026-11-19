import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { basename, dirname, join, resolve } from 'node:path'
import process from 'node:process'

const HELP = `Create and remove git worktrees that do not collide with the main checkout.

Two worktrees of one repo share the same Docker Compose project name and the same
ports unless something tells them apart. A "docker compose down" in one worktree
can then delete the database of another. These commands give every worktree its
own project name and its own free ports.

Run them from the root of the repo (a worktree root works too):

  pnpm worktree:create <name> [--base <ref>]
  pnpm worktree:remove <name>

worktree:create
  Makes <repo>/.worktrees/<name> on a new branch called <name>.
  The branch starts from main, or from --base <ref>.
  It copies the .env files of the main checkout (or the .env.example files when
  there is no .env; keys that only the worktree's .env.example has are added),
  then changes these values in the worktree copy:
    - COMPOSE_PROJECT_NAME=<repo>-<name> (added to the root .env)
    - every Docker port: DATABASE_PORT, API_PORT, SMTP_PORT_WEB, SMTP_PORT,
      STORAGE_API_PORT, STORAGE_CONSOLE_PORT (and EMAIL_PORT, which follows SMTP_PORT)
    - the dev server ports of the web apps: WEB_SPA_PORT and WEB_SSR_PORT (the
      vite.config.ts files read them, and fall back to 5174 and 5173)
    - the local URLs that contain those ports (API_BASE_URL, TRUSTED_ORIGINS,
      CLIENTS_WEB_APP_URL, CLIENTS_WEB_SSR_URL, STORAGE_ENDPOINT, VITE_API_URL,
      API_URL), so the front of the worktree talks to the API of the worktree
  Ports are free on this machine and not used by another worktree's .env.
  Then it runs "pnpm install" in the worktree, which installs the git hooks.
  It prints the ports it chose.
  Start the stack of the worktree with "pnpm docker:up" from inside it.

worktree:remove
  Stops the Docker stack of this worktree only, by its COMPOSE_PROJECT_NAME.
  Then it removes the worktree folder. It never deletes the branch, and it never
  deletes Docker volumes (drop them yourself with "docker volume rm" if you want).
  It stops and says why when the worktree has uncommitted changes, or when its
  branch has commits that are not pushed. A branch whose work is already in
  origin/main (for example after a squash merge) counts as done: the files it
  touches are the same in origin/main, so nothing would be lost.
`

const ENV_FILES = [
  '.env',
  'apps/api/.env',
  'apps/web-spa/.env',
  'apps/web-ssr/.env',
  'packages/openapi-generator/.env',
]

const DEFAULT_PORTS = {
  DATABASE_PORT: 5111,
  API_PORT: 3000,
  SMTP_PORT_WEB: 1080,
  SMTP_PORT: 1025,
  STORAGE_API_PORT: 9000,
  STORAGE_CONSOLE_PORT: 9001,
  WEB_SPA_PORT: 5174,
  WEB_SSR_PORT: 5173,
} as const

type PortKey = keyof typeof DEFAULT_PORTS

const PORT_KEYS = Object.keys(DEFAULT_PORTS) as PortKey[]

/** Env keys that must carry the same port as another key. */
const PORT_ALIASES: Record<string, PortKey> = { EMAIL_PORT: 'SMTP_PORT' }

const WORKTREE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u

class UserError extends Error {}

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    .toString()
    .trim()
}

function tryGit(args: string[], cwd: string): string | null {
  try {
    return git(args, cwd)
  } catch {
    return null
  }
}

function getMainRoot(): string {
  const commonDir = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], process.cwd())
  return dirname(commonDir)
}

function toProjectName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]/gu, '-')
}

function parseEnv(text: string): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(line)
    if (match?.[1] !== undefined && match[2] !== undefined) {
      vars[match[1]] = match[2].trim()
    }
  }
  return vars
}

function readEnvIfExists(path: string): Record<string, string> {
  return existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {}
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((done) => {
    const server = createServer()
    server.once('error', () => done(false))
    server.once('listening', () => server.close(() => done(true)))
    server.listen(port)
  })
}

function listWorktreeRoots(cwd: string): string[] {
  return git(['worktree', 'list', '--porcelain'], cwd)
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => line.slice('worktree '.length))
}

/** Ports already written in the root .env of the main checkout and of every worktree. */
function collectClaimedPorts(roots: string[]): Set<number> {
  const claimed = new Set<number>()
  for (const root of roots) {
    const vars = readEnvIfExists(join(root, '.env'))
    for (const key of PORT_KEYS) {
      const port = Number(vars[key])
      if (Number.isInteger(port) && port > 0) {
        claimed.add(port)
      }
    }
  }
  return claimed
}

async function pickPorts(
  mainRoot: string,
  basePorts: Record<PortKey, number>,
): Promise<Record<PortKey, number>> {
  const taken = collectClaimedPorts(listWorktreeRoots(mainRoot))
  for (const key of PORT_KEYS) {
    taken.add(basePorts[key])
  }
  const chosen = {} as Record<PortKey, number>
  for (const key of PORT_KEYS) {
    let port = basePorts[key] + 1
    while (taken.has(port) || !(await isPortFree(port))) {
      port += 1
      if (port > 65_535) {
        throw new UserError(`No free port found for ${key}.`)
      }
    }
    taken.add(port)
    chosen[key] = port
  }
  return chosen
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

/**
 * The text of an env file for the new worktree: the file of the main checkout when
 * it exists, completed with the keys that the worktree's own .env.example has and
 * that file lacks (the main checkout may be on another branch). Without a file in
 * the main checkout, the worktree's .env.example.
 */
function readEnvSource(mainRoot: string, target: string, relativePath: string): string | null {
  const real = join(mainRoot, relativePath)
  const example = join(target, `${relativePath}.example`)
  const exampleText = existsSync(example) ? readFileSync(example, 'utf8') : null
  if (!existsSync(real)) {
    return exampleText
  }
  const realText = readFileSync(real, 'utf8')
  if (exampleText === null) {
    return realText
  }
  const present = parseEnv(realText)
  const missing = exampleText.split('\n').filter((line) => {
    const key = /^\s*([A-Za-z_][A-Za-z0-9_]*)=/u.exec(line)?.[1]
    return key !== undefined && !(key in present)
  })
  return missing.length === 0
    ? realText
    : `${realText.replace(/\n*$/u, '\n')}${missing.join('\n')}\n`
}

function rewriteEnv(
  text: string,
  ports: Record<PortKey, number>,
  oldToNew: Map<number, number>,
  projectName: string | null,
): string {
  const lines = text.split('\n').map((line) => {
    const match = /^(\s*)([A-Za-z_][A-Za-z0-9_]*)=(.*?)(\r?)$/u.exec(line)
    if (!match) {
      return line
    }
    const [, indent = '', key = '', value = '', eol = ''] = match
    const portKey = key in ports ? (key as PortKey) : PORT_ALIASES[key]
    if (portKey !== undefined) {
      return `${indent}${key}=${ports[portKey]}${eol}`
    }
    let next = value
    for (const [oldPort, newPort] of oldToNew) {
      const pattern = new RegExp(
        `(localhost|127\\.0\\.0\\.1):${escapeRegExp(String(oldPort))}(?!\\d)`,
        'gu',
      )
      next = next.replace(pattern, `$1:${newPort}`)
    }
    return `${indent}${key}=${next}${eol}`
  })

  if (projectName === null) {
    return lines.join('\n')
  }
  const withoutProject = lines.filter((line) => !/^\s*COMPOSE_PROJECT_NAME=/u.test(line))
  const present = parseEnv(text)
  const missingPorts = PORT_KEYS.filter((key) => !(key in present)).map(
    (key) => `${key}=${ports[key]}`,
  )
  const body = withoutProject.join('\n').replace(/\n*$/u, '')
  return [`COMPOSE_PROJECT_NAME=${projectName}`, body, ...missingPorts, ''].join('\n')
}

async function create(name: string, base: string): Promise<void> {
  if (!WORKTREE_NAME_PATTERN.test(name)) {
    throw new UserError(
      `"${name}" is not a valid name. Use letters, digits, dots, dashes and underscores.`,
    )
  }
  const mainRoot = getMainRoot()
  const target = join(mainRoot, '.worktrees', name)
  if (existsSync(target)) {
    throw new UserError(`${target} already exists.`)
  }
  if (tryGit(['rev-parse', '--verify', '--quiet', `refs/heads/${name}`], mainRoot) !== null) {
    throw new UserError(`The branch "${name}" already exists. Pick another name.`)
  }

  const rootVars = readEnvIfExists(join(mainRoot, '.env'))
  const basePorts = {} as Record<PortKey, number>
  for (const key of PORT_KEYS) {
    const fromFile = Number(rootVars[key])
    basePorts[key] = Number.isInteger(fromFile) && fromFile > 0 ? fromFile : DEFAULT_PORTS[key]
  }
  const ports = await pickPorts(mainRoot, basePorts)
  const oldToNew = new Map<number, number>(PORT_KEYS.map((key) => [basePorts[key], ports[key]]))
  const projectName = toProjectName(`${basename(mainRoot)}-${name}`)

  git(['worktree', 'add', '-b', name, target, base], mainRoot)
  console.log(`Created ${target} on branch ${name} (from ${base}).`)

  for (const relativePath of ENV_FILES) {
    const source = readEnvSource(mainRoot, target, relativePath)
    if (source === null) {
      continue
    }
    const text = rewriteEnv(source, ports, oldToNew, relativePath === '.env' ? projectName : null)
    writeFileSync(join(target, relativePath), text)
    console.log(`Wrote ${relativePath}.`)
  }

  console.log(`\nDocker project name: ${projectName}`)
  console.log('Ports:')
  for (const key of PORT_KEYS) {
    console.log(`  ${key}=${ports[key]} (main checkout: ${basePorts[key]})`)
  }

  console.log('\nRunning pnpm install in the worktree...')
  const install = spawnSync('pnpm', ['install'], { cwd: target, stdio: 'inherit' })
  if (install.status !== 0) {
    throw new UserError(
      `pnpm install failed in ${target}. The worktree exists. Run pnpm install there before you commit: without it the git hooks do not run.`,
    )
  }
  console.log(`\nDone. cd ${target}`)
}

/** Why the branch counts as not pushed, or null when everything is on its upstream. */
function findUnpushedProblem(target: string, branch: string): string | null {
  if (tryGit(['rev-parse', '--abbrev-ref', '@{upstream}'], target) === null) {
    return `The branch "${branch}" is not pushed (no upstream). Push it first.`
  }
  const unpushed = git(['rev-list', '--count', '@{upstream}..HEAD'], target)
  return unpushed === '0'
    ? null
    : `The branch "${branch}" has ${unpushed} commit(s) that are not pushed.`
}

/**
 * True when the work of the branch is already in the base branch, for example after
 * a squash merge: every file the branch touches is the same in origin/main.
 */
function isIntegrated(target: string, mainRoot: string): boolean {
  tryGit(['fetch', '--quiet', 'origin'], mainRoot)
  const baseRef = ['origin/main', 'main'].find(
    (ref) => tryGit(['rev-parse', '--verify', '--quiet', ref], mainRoot) !== null,
  )
  if (baseRef === undefined) {
    return false
  }
  const mergeBase = tryGit(['merge-base', baseRef, 'HEAD'], target)
  if (mergeBase === null) {
    return false
  }
  const touched = git(['diff', '--name-only', mergeBase, 'HEAD'], target)
    .split('\n')
    .filter((file) => file !== '')
  if (touched.length === 0) {
    return true
  }
  return tryGit(['diff', '--quiet', baseRef, 'HEAD', '--', ...touched], target) !== null
}

function remove(name: string): void {
  if (!WORKTREE_NAME_PATTERN.test(name)) {
    throw new UserError(`"${name}" is not a valid name.`)
  }
  const mainRoot = getMainRoot()
  const target = join(mainRoot, '.worktrees', name)
  if (!listWorktreeRoots(mainRoot).includes(resolve(target))) {
    throw new UserError(`${target} is not a worktree of this repo.`)
  }

  const changes = git(['status', '--porcelain'], target)
  if (changes !== '') {
    throw new UserError(
      `The worktree has uncommitted changes. Commit or discard them first:\n${changes}`,
    )
  }
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], target)
  if (branch === 'HEAD') {
    throw new UserError('The worktree has a detached HEAD. Check out a branch and push it first.')
  }
  const notPushed = findUnpushedProblem(target, branch)
  if (notPushed !== null) {
    if (!isIntegrated(target, mainRoot)) {
      throw new UserError(notPushed)
    }
    console.log(
      `The branch "${branch}" is not pushed, but its work is already in origin/main. Going on.`,
    )
  }

  const projectName = readEnvIfExists(join(target, '.env')).COMPOSE_PROJECT_NAME
  const mainProjectName =
    readEnvIfExists(join(mainRoot, '.env')).COMPOSE_PROJECT_NAME ??
    toProjectName(basename(mainRoot))
  if (projectName === undefined || projectName === '') {
    console.log(
      'No COMPOSE_PROJECT_NAME in the worktree .env: the Docker stack is left alone (it cannot be told apart from another).',
    )
  } else if (projectName === mainProjectName) {
    throw new UserError(
      `The worktree uses the same Docker project name as the main checkout ("${projectName}"). Not stopping anything.`,
    )
  } else {
    console.log(`Stopping the Docker stack "${projectName}"...`)
    const down = spawnSync('docker', ['compose', '--project-name', projectName, 'down'], {
      cwd: target,
      stdio: 'inherit',
    })
    if (down.status !== 0) {
      throw new UserError('docker compose down failed. The worktree is still there.')
    }
  }

  git(['worktree', 'remove', target], mainRoot)
  console.log(`Removed ${target}. The branch "${branch}" is kept.`)
}

function parseArgs(args: string[]): { base: string | undefined; positional: string[] } {
  let base: string | undefined
  const positional: string[] = []
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? ''
    if (arg === '--base') {
      index += 1
      base = args[index]
      if (base === undefined || base.startsWith('-')) {
        throw new UserError('--base needs a git ref.')
      }
    } else if (arg.startsWith('--base=')) {
      base = arg.slice('--base='.length)
    } else if (arg.startsWith('-')) {
      throw new UserError(`Unknown option ${arg}.`)
    } else {
      positional.push(arg)
    }
  }
  return { base, positional }
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2)
  const wantsHelp = rest.includes('--help') || rest.includes('-h') || command === '--help'
  if (wantsHelp || (command !== 'create' && command !== 'remove')) {
    console.log(HELP)
    process.exitCode = wantsHelp ? 0 : 1
    return
  }

  const { base, positional } = parseArgs(rest)
  const name = positional[0]
  if (name === undefined || positional.length > 1) {
    throw new UserError(
      `Usage: pnpm worktree:${command} <name>${command === 'create' ? ' [--base <ref>]' : ''}`,
    )
  }
  if (base !== undefined && command === 'remove') {
    throw new UserError('worktree:remove takes no --base option.')
  }
  if (command === 'create') {
    await create(name, base ?? 'main')
  } else {
    remove(name)
  }
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
