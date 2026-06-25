import process from 'node:process'

// Vendored copy of cli/utils.ts so that .boilerstone/cli/ stays self-contained:
// a consumer can fetch only the .boilerstone/ directory (e.g. via tiged) and run
// the CLI without the producer-side cli/ folder being present. Keep in sync with
// the root cli/utils.ts.

// ANSI color codes for console output
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
