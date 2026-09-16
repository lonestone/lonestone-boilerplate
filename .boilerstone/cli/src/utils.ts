import {
  execFileSync,
  spawnSync,
  type ExecFileSyncOptions,
  type SpawnSyncOptions,
  type SpawnSyncReturns,
} from 'node:child_process'
import { closeSync, cpSync, openSync, renameSync, rmSync } from 'node:fs'
import process from 'node:process'

export const isWindows = process.platform === 'win32'

export const colors = {
  reset: '\x1B[0m',
  bright: '\x1B[1m',
  dim: '\x1B[2m',
  red: '\x1B[31m',
  green: '\x1B[32m',
  yellow: '\x1B[33m',
  blue: '\x1B[34m',
  cyan: '\x1B[36m',
} as const

export function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`
}

/**
 * A copy of process.env with Git's repo-pointer overrides removed.
 *
 * Git hooks (pre-push, etc.) and some CI runners export GIT_DIR / GIT_WORK_TREE,
 * which force every `git` call to target THAT repo and ignore the `cwd` we pass.
 * Use this whenever a git command must operate on a specific path, not on
 * whatever repo happens to be invoking us.
 */
export function isolatedGitEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  delete env.GIT_DIR
  delete env.GIT_WORK_TREE
  return env
}

function resolveCommand(command: string): string {
  if (!isWindows) {
    return command
  }
  if (command === 'pnpm' || command === 'npm' || command === 'npx') {
    return `${command}.cmd`
  }
  return command
}

/**
 * Run a binary and return stdout. On Windows, cmd shims (pnpm.cmd) and .exe
 * files are resolved the same way a user terminal would.
 */
export function runFileSync(
  command: string,
  args: readonly string[],
  options: ExecFileSyncOptions = {},
): string {
  if (isWindows) {
    const result = spawnSync(resolveCommand(command), args, {
      cwd: typeof options.cwd === 'string' ? options.cwd : undefined,
      env: options.env as NodeJS.ProcessEnv | undefined,
      encoding: 'utf-8',
      stdio: options.stdio,
      shell: true,
      windowsHide: true,
    })
    if (result.error) {
      throw result.error
    }
    if (result.status !== 0) {
      throw new Error(
        `${command} ${args.join(' ')} failed: ${result.stderr || `exit ${result.status}`}`,
      )
    }
    return result.stdout ?? ''
  }

  return execFileSync(command, args, { encoding: 'utf-8', ...options }).toString()
}

export function spawnProcessSync(
  command: string,
  args: readonly string[],
  options: SpawnSyncOptions = {},
): SpawnSyncReturns<string | Buffer> {
  return spawnSync(resolveCommand(command), args, {
    ...options,
    shell: options.shell ?? isWindows,
    windowsHide: true,
  })
}

export function canReadTty(): boolean {
  if (process.stdin.isTTY) {
    return true
  }
  const device = isWindows ? '\\\\.\\CONIN$' : '/dev/tty'
  try {
    const fd = openSync(device, 'r')
    closeSync(fd)
    return true
  } catch {
    return false
  }
}

/** rename, with copy+remove when the source and destination are on different volumes. */
export function movePath(source: string, destination: string): void {
  try {
    renameSync(source, destination)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') {
      throw error
    }
    cpSync(source, destination, { recursive: true })
    rmSync(source, { recursive: true, force: true })
  }
}
