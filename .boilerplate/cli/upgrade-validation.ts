import { execFileSync, execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { colorize } from '../../cli/utils'

interface ValidationResult {
  passed: boolean
  checks: Array<{
    name: string
    status: 'passed' | 'failed' | 'unavailable'
    output?: string
  }>
}

interface IntentionResult {
  id: string
  status: 'applied' | 'skipped' | 'blocked'
  reason?: string
  validation?: ValidationResult
  commitHash?: string
}

interface UpgradeReport {
  sourceVersion: string
  targetVersion: string
  startTime: string
  endTime?: string
  intentions: IntentionResult[]
  summary: {
    total: number
    applied: number
    skipped: number
    blocked: number
  }
}

function checkGitClean(workDir: string): boolean {
  try {
    const output = execFileSync('git', ['status', '--porcelain'], {
      cwd: workDir,
      encoding: 'utf-8',
    }).trim()
    return output === ''
  }
  catch {
    return false
  }
}

function createUpgradeBranch(workDir: string, sourceVersion: string, targetVersion: string): string {
  const branchName = `upgrade/v${sourceVersion}-to-v${targetVersion}`
  try {
    execFileSync('git', ['checkout', '-b', branchName], {
      cwd: workDir,
      encoding: 'utf-8',
    })
    return branchName
  }
  catch (error) {
    throw new Error(`Failed to create upgrade branch: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function commitIntention(workDir: string, intentionId: string): string {
  try {
    execFileSync('git', ['add', '-A'], { cwd: workDir, encoding: 'utf-8' })
    const output = execFileSync('git', ['commit', '-m', `feat: apply migration intention ${intentionId}`], {
      cwd: workDir,
      encoding: 'utf-8',
    })
    const match = output.match(/\[.*?([a-f0-9]{7})\]/)
    return match?.[1] || 'unknown'
  }
  catch (error) {
    throw new Error(`Failed to commit intention: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function runValidation(workDir: string, intentionId: string, customChecks?: string[]): ValidationResult {
  const checks: Array<{ name: string, status: 'passed' | 'failed' | 'unavailable', output?: string }> = []

  const globalChecks = [
    { name: 'lint', command: 'pnpm', args: ['lint'] },
    { name: 'typecheck', command: 'pnpm', args: ['typecheck'] },
    { name: 'test', command: 'pnpm', args: ['test'] },
    { name: 'build', command: 'pnpm', args: ['build'] },
  ]

  for (const check of globalChecks) {
    try {
      const output = execFileSync(check.command, check.args, {
        cwd: workDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      checks.push({ name: check.name, status: 'passed', output })
    }
    catch (error: unknown) {
      const err = error as { message?: string, stdout?: string, stderr?: string }
      // pnpm reports "Missing script" on stderr, not in the error message
      const combined = [err.message, err.stdout, err.stderr].filter(Boolean).join('\n')
      if (/missing script|command not found/i.test(combined)) {
        checks.push({ name: check.name, status: 'unavailable' })
      }
      else {
        checks.push({ name: check.name, status: 'failed', output: err.stdout || err.stderr || err.message || String(error) })
      }
    }
  }

  if (customChecks) {
    for (const check of customChecks) {
      try {
        if (!check.trim()) {
          checks.push({ name: check, status: 'unavailable' })
          continue
        }

        // Custom checks are full command lines authored in project config; run them
        // through the shell so quoting and operators behave as written
        const output = execSync(check, {
          cwd: workDir,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        })
        checks.push({ name: check, status: 'passed', output })
      }
      catch (error: unknown) {
        const output = error instanceof Error ? (error as { stdout?: string, stderr?: string }).stdout || (error as { stdout?: string, stderr?: string }).stderr || error.message : String(error)
        checks.push({ name: check, status: 'failed', output })
      }
    }
  }

  const passed = checks.every(c => c.status === 'passed' || c.status === 'unavailable')
  return { passed, checks }
}

function generateBlockedReport(
  intentionId: string,
  reason: string,
  validation?: ValidationResult,
  suggestedActions?: string[],
): string {
  return `# Blocked Intention: ${intentionId}

## Reason

${reason}

## Validation Results

${validation?.checks.map(c => `- **${c.name}**: ${c.status}`).join('\n') || 'No validation ran'}

## Suggested Next Actions

${suggestedActions?.map(a => `- ${a}`).join('\n') || '- Review the intention manually\n- Check project divergence\n- Consider skipping with a clear reason'}

## Timestamp

${new Date().toISOString()}
`
}

function generateFinalReport(report: UpgradeReport): string {
  return `# Upgrade Report: v${report.sourceVersion} → v${report.targetVersion}

## Summary

- **Total intentions**: ${report.summary.total}
- **Applied**: ${report.summary.applied}
- **Skipped**: ${report.summary.skipped}
- **Blocked**: ${report.summary.blocked}
- **Started**: ${report.startTime}
- **Completed**: ${report.endTime || 'in progress'}

## Applied Intentions

${report.intentions
  .filter(i => i.status === 'applied')
  .map(i => `- [✓] ${i.id}${i.commitHash ? ` (${i.commitHash})` : ''}`)
  .join('\n') || '_none_'}

## Skipped Intentions

${report.intentions
  .filter(i => i.status === 'skipped')
  .map(i => `- [⊘] ${i.id} - ${i.reason}`)
  .join('\n') || '_none_'}

## Blocked Intentions

${report.intentions
  .filter(i => i.status === 'blocked')
  .map(i => `- [✗] ${i.id} - ${i.reason}`)
  .join('\n') || '_none_'}

## Validation Summary

${report.intentions
  .filter(i => i.validation)
  .map(i => `### ${i.id}\n${i.validation!.checks.map(c => `- ${c.name}: ${c.status}`).join('\n')}`)
  .join('\n\n') || '_no validation data_'}

---

*Generated by boilerplate upgrade system*
`
}

function writeStatusReport(boilerplateDir: string, report: UpgradeReport): void {
  const statusPath = join(boilerplateDir, 'status.md')
  const content = generateFinalReport(report)
  writeFileSync(statusPath, content, 'utf-8')
}

function writeBlockedReport(
  boilerplateDir: string,
  intentionId: string,
  reason: string,
  validation?: ValidationResult,
  suggestedActions?: string[],
): void {
  const blockedPath = join(boilerplateDir, 'blocked.md')
  const content = generateBlockedReport(intentionId, reason, validation, suggestedActions)
  writeFileSync(blockedPath, content, 'utf-8')
}

function printValidationResult(result: ValidationResult): void {
  console.log(`\n  ${colorize('🔍 Validation Results', 'cyan')}\n`)
  for (const check of result.checks) {
    const icon = check.status === 'passed'
      ? colorize('✓', 'green')
      : check.status === 'failed'
        ? colorize('✗', 'red')
        : colorize('⊘', 'yellow')
    console.log(`    ${icon} ${check.name}: ${check.status}`)
  }
  console.log()
}

export {
  checkGitClean,
  commitIntention,
  createUpgradeBranch,
  generateBlockedReport,
  generateFinalReport,
  type IntentionResult,
  printValidationResult,
  runValidation,
  type UpgradeReport,
  type ValidationResult,
  writeBlockedReport,
  writeStatusReport,
}
