import { spawnSync } from 'node:child_process'
import process from 'node:process'

/**
 * Runs the quality gate before a push, without any shell syntax.
 *
 * Lefthook tokenizes inline `run:` blocks on Windows and drops quotes, so the
 * checks live here and `lefthook.yml` only calls a single plain command.
 */

const DELETE_REF = '(delete)'

interface QualityCheck {
  label: string
  script: string
}

const QUALITY_CHECKS: QualityCheck[] = [
  { label: 'linter', script: 'lint' },
  { label: 'type check', script: 'typecheck' },
  { label: 'tests', script: 'test' },
]

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY === true) {
    return ''
  }

  process.stdin.setEncoding('utf8')
  let input = ''
  for await (const chunk of process.stdin) {
    input += String(chunk)
  }
  return input
}

/**
 * Git feeds one `<local ref> <local sha> <remote ref> <remote sha>` line per ref
 * to the pre-push hook, and uses `(delete)` as the local ref when the push only
 * removes a remote branch. Nothing local changes, so the checks are pointless.
 */
function isDeletePush(pushRefs: string): boolean {
  const lines = pushRefs
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')

  if (lines.length === 0) {
    return false
  }

  return lines.every((line) => line.startsWith(DELETE_REF))
}

/**
 * `shell: true` is required: on Windows `pnpm` resolves to `pnpm.cmd`, which
 * Node refuses to spawn directly. The command is a single string rather than an
 * argument list because Node deprecates passing arguments alongside a shell.
 * Every script name comes from the literals above, never from user input.
 */
function runScript(script: string): boolean {
  const result = spawnSync(`pnpm ${script}`, { stdio: 'inherit', shell: true })
  if (result.error !== undefined) {
    throw result.error
  }
  return result.status === 0
}

async function main(): Promise<void> {
  const pushRefs = await readStdin()

  if (isDeletePush(pushRefs)) {
    process.stdout.write(`${DELETE_REF} found in push refs, skipping pre-push checks\n`)
    return
  }

  for (const check of QUALITY_CHECKS) {
    process.stdout.write(`Running ${check.label}...\n`)
    if (!runScript(check.script)) {
      process.stderr.write(`\nPre-push check failed: ${check.label}\n`)
      process.exitCode = 1
      return
    }
  }

  process.stdout.write('All pre-push checks passed!\n')
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
