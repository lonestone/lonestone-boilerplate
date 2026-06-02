import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import Enquirer from 'enquirer'
import { colorize } from '../../cli/utils'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..', '..')
const boilerplateDir = join(projectRoot, '.boilerplate')

interface InputPromptOptions {
  message: string
  initial?: string
}

interface ConfirmPromptOptions {
  name: string
  message: string
  initial?: boolean
}

interface InputPrompt {
  run: () => Promise<string>
}

interface ConfirmPrompt {
  run: () => Promise<boolean>
}

interface EnquirerConstructors {
  Input: new (options: InputPromptOptions) => InputPrompt
  Confirm: new (options: ConfirmPromptOptions) => ConfirmPrompt
}

const { Input, Confirm } = Enquirer as unknown as EnquirerConstructors

interface BoilerplateState {
  schemaVersion: number
  source: {
    repository: string
    currentVersion: string
  }
  trackedDomains: string[]
  intentions: {
    applied: Array<{ id: string, appliedAt: string }>
    skipped: Array<{ id: string, reason: string }>
  }
}

interface ReleaseInfo {
  version: string
  tag: string
  date: string
  hasMigrations: boolean
}

interface MigrationIntention {
  id: string
  file: string
  domain?: string
  classification: 'no-migration' | 'informational' | 'migration' | 'breaking-manual'
}

interface UpgradePath {
  sourceVersion: string
  targetVersion: string
  checkpoints: string[]
  releases: string[]
  intentions: MigrationIntention[]
  sourceTag: string
  targetTag: string
}

function prompt(message: string, initial: string): Promise<string> {
  const input = new Input({ message, initial })
  return input.run()
}

function _confirm(message: string): Promise<boolean> {
  const confirmPrompt = new Confirm({ name: 'confirm', message, initial: false })
  return confirmPrompt.run()
}

function runGitCommand(args: string[]): string {
  return execSync(`git ${args.join(' ')}`, { cwd: projectRoot, encoding: 'utf-8' }).trim()
}

function getReleases(): ReleaseInfo[] {
  const tags = runGitCommand(['tag', '--list', 'v*', '--sort=-v:refname'])
  if (!tags) {
    return []
  }

  return tags.split('\n').filter(Boolean).map((tag) => {
    const version = tag.replace(/^v/, '')
    const date = runGitCommand(['log', '-1', '--format=%ci', tag]).split(' ')[0]
    const intentionsPath = join(boilerplateDir, 'migration-intentions', tag, 'index.md')
    return {
      version,
      tag,
      date,
      hasMigrations: existsSync(intentionsPath),
    }
  })
}

function cmdVersionsList(): void {
  console.log(`\n${colorize('📦 Available Boilerplate Versions', 'cyan')}\n`)

  const releases = getReleases()
  if (releases.length === 0) {
    console.log(`  ${colorize('⚠', 'yellow')} No releases found`)
    return
  }

  for (const release of releases) {
    const migrationStatus = release.hasMigrations
      ? colorize('migrations available', 'yellow')
      : colorize('no migration required', 'green')
    console.log(`  ${colorize(release.tag, 'bright')} (${release.date}) - ${migrationStatus}`)
  }
  console.log()
}

function readBoilerplateJson(projectPath: string): BoilerplateState | null {
  const boilerplateJsonPath = join(projectPath, '.boilerplate', 'boilerplate.json')
  if (!existsSync(boilerplateJsonPath)) {
    return null
  }

  const content = readFileSync(boilerplateJsonPath, 'utf-8')
  return JSON.parse(content) as BoilerplateState
}

function writeBoilerplateJson(projectPath: string, state: BoilerplateState): void {
  const boilerplateJsonPath = join(projectPath, '.boilerplate', 'boilerplate.json')
  writeFileSync(boilerplateJsonPath, `${JSON.stringify(state, null, 2)}\n`, 'utf-8')
}

function detectSourceVersion(projectPath: string): { version: string, confidence: 'high' | 'medium' | 'low' } | null {
  const state = readBoilerplateJson(projectPath)
  if (state) {
    return { version: state.source.currentVersion, confidence: 'high' }
  }

  try {
    const mergeBase = runGitCommand(['merge-base', 'HEAD', 'v1.0.0'])
    if (mergeBase) {
      const tags = runGitCommand(['tag', '--points-at', mergeBase, '--sort=-v:refname'])
      if (tags) {
        const firstTag = tags.split('\n').find(t => t.startsWith('v'))
        if (firstTag) {
          return { version: firstTag.replace(/^v/, ''), confidence: 'medium' }
        }
      }
    }
  }
  catch {
    // Git detection failed
  }

  return null
}

function cmdUpgradeInit(projectPath: string): void {
  console.log(`\n${colorize('🔧 Initializing Boilerplate Tracking', 'cyan')}\n`)

  const absolutePath = projectPath.startsWith('/') ? projectPath : join(process.cwd(), projectPath)

  if (!existsSync(absolutePath)) {
    console.error(`  ${colorize('❌', 'red')} Project path not found: ${absolutePath}`)
    process.exit(1)
  }

  const existing = readBoilerplateJson(absolutePath)
  if (existing) {
    console.log(`  ${colorize('✓', 'green')} boilerplate.json already exists`)
    console.log(`  ${colorize('Current version:', 'dim')} ${existing.source.currentVersion}`)
    console.log(`  ${colorize('Tracked domains:', 'dim')} ${existing.trackedDomains.join(', ')}`)
    return
  }

  const detected = detectSourceVersion(absolutePath)

  let version = '1.0.0'
  if (detected) {
    console.log(`  ${colorize('🔍', 'cyan')} Detected source version: ${colorize(detected.version, 'bright')} (confidence: ${detected.confidence})`)
    version = detected.version
  }
  else {
    console.log(`  ${colorize('⚠', 'yellow')} Could not detect source version`)
  }

  prompt('Enter source boilerplate version', version).then((sourceVersion) => {
    const state: BoilerplateState = {
      schemaVersion: 1,
      source: {
        repository: 'lonestone/lonestone-boilerplate',
        currentVersion: sourceVersion,
      },
      trackedDomains: ['tooling', 'api', 'frontend', 'ci', 'docker-env'],
      intentions: {
        applied: [],
        skipped: [],
      },
    }

    writeBoilerplateJson(absolutePath, state)
    console.log(`\n  ${colorize('✓', 'green')} Created boilerplate.json`)
    console.log(`  ${colorize('Source version:', 'dim')} ${sourceVersion}`)
  })
}

function getCheckpoints(): Array<{ id: string, targetVersion: string, minSourceVersion: string, file: string }> {
  const checkpointsDir = join(boilerplateDir, 'legacy-checkpoints')
  if (!existsSync(checkpointsDir)) {
    return []
  }
  try {
    const files = execSync(`ls -1 ${checkpointsDir}/*.md 2>/dev/null || true`, { encoding: 'utf-8' })
      .trim()
      .split('\n')
      .filter(f => f && !f.endsWith('TEMPLATE.md') && !f.endsWith('index.md'))
    return files.map((file) => {
      const id = basename(file).replace('.md', '')
      const parts = id.split('-to-')
      return { id, targetVersion: parts[1] || '', minSourceVersion: parts[1] ? '0.0.0' : '', file }
    })
  }
  catch {
    return []
  }
}

function computeUpgradePath(sourceVersion: string, targetVersion: string, trackedDomains: string[], appliedIntentions: string[], skippedIntentions: string[]): UpgradePath {
  const releases = getReleases()
  const checkpoints = getCheckpoints()

  const sourceTag = releases.find(r => r.version === sourceVersion)?.tag || `v${sourceVersion}`
  const targetTag = releases.find(r => r.version === targetVersion)?.tag || `v${targetVersion}`

  const selectedCheckpoints: string[] = []

  // If source is older than the earliest release with intentions, insert a checkpoint
  const earliestRelease = releases
    .filter(r => r.hasMigrations)
    .sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }))[0]

  if (earliestRelease) {
    for (const cp of checkpoints) {
      if (versionLte(cp.targetVersion, earliestRelease.version) && versionGt(cp.targetVersion, sourceVersion)) {
        selectedCheckpoints.push(cp.id)
      }
    }
  }

  const releasesInRange = releases
    .filter((r) => {
      const v = r.version
      return versionGt(v, sourceVersion) && versionLte(v, targetVersion)
    })
    .sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }))

  const intentions: MigrationIntention[] = []

  for (const release of releasesInRange) {
    const indexFile = join(boilerplateDir, 'migration-intentions', `v${release.version}`, 'index.md')
    if (!existsSync(indexFile)) {
      continue
    }

    const releaseDir = join(boilerplateDir, 'migration-intentions', `v${release.version}`)
    const intentionFiles = execSync(`ls -1 ${releaseDir}/*.md 2>/dev/null || true`, { encoding: 'utf-8' })
      .trim()
      .split('\n')
      .filter(f => f && !f.endsWith('index.md') && !f.endsWith('classification.md'))

    for (const file of intentionFiles) {
      const intentionId = `v${release.version}/${basename(file).replace('.md', '')}`
      if (appliedIntentions.includes(intentionId) || skippedIntentions.includes(intentionId)) {
        continue
      }

      // Infer domain from file path: files in version subdirectories (e.g. v1.0.0/api/s3-module.md)
      const relativePath = file.replace(releaseDir, '')
      const domain = relativePath.startsWith('/') ? relativePath.split('/')[1] : undefined

      // Skip if trackedDomains is non-empty and this intention's domain doesn't match
      if (trackedDomains.length > 0 && domain && !trackedDomains.includes(domain)) {
        continue
      }

      intentions.push({
        id: intentionId,
        file,
        domain,
        classification: 'migration',
      })
    }
  }

  return {
    sourceVersion,
    targetVersion,
    checkpoints: selectedCheckpoints,
    releases: releasesInRange.map(r => r.tag),
    intentions,
    sourceTag,
    targetTag,
  }
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = i < pa.length ? pa[i] : 0
    const db = i < pb.length ? pb[i] : 0
    if (da !== db)
      return da - db
  }
  return 0
}

function versionGt(a: string, b: string): boolean {
  return compareVersions(a, b) > 0
}

function versionLte(a: string, b: string): boolean {
  return compareVersions(a, b) <= 0
}

function basename(path: string): string {
  return path.split('/').pop() || ''
}

function cmdUpgradePath(fromVersion: string, toVersion: string, projectPath: string): void {
  console.log(`\n${colorize('🛤️  Upgrade Path Resolution', 'cyan')}\n`)

  const absolutePath = projectPath ? (projectPath.startsWith('/') ? projectPath : join(process.cwd(), projectPath)) : projectRoot
  const state = readBoilerplateJson(absolutePath)

  let sourceVersion = fromVersion
  let trackedDomains: string[] = []
  let appliedIntentions: string[] = []
  let skippedIntentions: string[] = []

  if (state) {
    sourceVersion = fromVersion || state.source.currentVersion
    trackedDomains = state.trackedDomains
    appliedIntentions = state.intentions.applied.map(i => i.id)
    skippedIntentions = state.intentions.skipped.map(i => i.id)
  }

  if (!sourceVersion) {
    console.error(`  ${colorize('❌', 'red')} No source version specified or detected`)
    process.exit(1)
  }

  const path = computeUpgradePath(sourceVersion, toVersion, trackedDomains, appliedIntentions, skippedIntentions)

  console.log(`  ${colorize('Source:', 'dim')} ${colorize(`v${path.sourceVersion}`, 'bright')}`)
  console.log(`  ${colorize('Target:', 'dim')} ${colorize(`v${path.targetVersion}`, 'bright')}`)
  console.log(`  ${colorize('Releases:', 'dim')} ${path.releases.length}`)
  console.log(`  ${colorize('Pending intentions:', 'dim')} ${path.intentions.length}`)

  if (path.intentions.length > 0) {
    console.log(`\n  ${colorize('📋 Pending Intentions:', 'cyan')}\n`)
    for (const intention of path.intentions) {
      console.log(`    ${colorize('•', 'cyan')} ${colorize(intention.id, 'bright')}`)
    }
  }

  console.log()
}

function cmdUpgradeStatus(projectPath: string): void {
  console.log(`\n${colorize('📊 Boilerplate Upgrade Status', 'cyan')}\n`)

  const absolutePath = projectPath ? (projectPath.startsWith('/') ? projectPath : join(process.cwd(), projectPath)) : projectRoot
  const state = readBoilerplateJson(absolutePath)

  if (!state) {
    console.log(`  ${colorize('⚠', 'yellow')} No boilerplate.json found`)
    console.log(`  ${colorize('→', 'cyan')} Run ${colorize('boilerplate upgrade init', 'bright')} first`)
    return
  }

  console.log(`  ${colorize('Repository:', 'dim')} ${state.source.repository}`)
  console.log(`  ${colorize('Current version:', 'dim')} ${colorize(state.source.currentVersion, 'bright')}`)
  console.log(`  ${colorize('Tracked domains:', 'dim')} ${state.trackedDomains.join(', ')}`)
  console.log(`  ${colorize('Applied intentions:', 'dim')} ${state.intentions.applied.length}`)
  console.log(`  ${colorize('Skipped intentions:', 'dim')} ${state.intentions.skipped.length}`)

  if (state.intentions.applied.length > 0) {
    console.log(`\n  ${colorize('✓ Applied:', 'green')}`)
    for (const intention of state.intentions.applied) {
      console.log(`    ${colorize('•', 'green')} ${intention.id} (${intention.appliedAt})`)
    }
  }

  if (state.intentions.skipped.length > 0) {
    console.log(`\n  ${colorize('⊘ Skipped:', 'yellow')}`)
    for (const intention of state.intentions.skipped) {
      console.log(`    ${colorize('•', 'yellow')} ${intention.id} - ${intention.reason}`)
    }
  }

  console.log()
}

async function cmdUpgradePrepare(projectPath: string, toVersion: string): Promise<void> {
  console.log(`\n${colorize('📦 Preparing Upgrade Context', 'cyan')}\n`)

  const absolutePath = projectPath ? (projectPath.startsWith('/') ? projectPath : join(process.cwd(), projectPath)) : projectRoot
  const state = readBoilerplateJson(absolutePath)

  if (!state) {
    console.error(`  ${colorize('❌', 'red')} No boilerplate.json found. Run init first.`)
    process.exit(1)
  }

  const dirtyOutput = execSync('git status --porcelain', { cwd: absolutePath, encoding: 'utf-8' }).trim()
  if (dirtyOutput) {
    console.error(`  ${colorize('❌', 'red')} Git worktree is dirty. Clean before upgrading.`)
    process.exit(1)
  }

  const upgradePath = computeUpgradePath(
    state.source.currentVersion,
    toVersion,
    state.trackedDomains,
    state.intentions.applied.map(i => i.id),
    state.intentions.skipped.map(i => i.id),
  )

  const branchName = `upgrade/v${upgradePath.sourceVersion}-to-v${upgradePath.targetVersion}`
  execSync(`git checkout -b ${branchName} 2>/dev/null || true`, { cwd: absolutePath, encoding: 'utf-8' })
  console.log(`  ${colorize('→', 'cyan')} Working on branch: ${colorize(branchName, 'bright')}`)

  const upgradeDir = join(absolutePath, '.boilerplate', 'upgrade')
  if (existsSync(upgradeDir)) {
    execSync(`rm -rf ${upgradeDir}`, { cwd: absolutePath })
  }

  mkdirSync(join(upgradeDir, 'reference', 'source'), { recursive: true })
  mkdirSync(join(upgradeDir, 'reference', 'target'), { recursive: true })
  mkdirSync(join(upgradeDir, 'intentions'), { recursive: true })

  for (const intention of upgradePath.intentions) {
    if (existsSync(intention.file)) {
      const destFile = join(upgradeDir, 'intentions', `${intention.id.replace('/', '-')}.md`)
      execSync(`cp "${intention.file}" "${destFile}"`, { encoding: 'utf-8' })
    }
  }

  // Extract reference files from git tags
  try {
    execSync(`git archive --format=tar ${upgradePath.sourceTag} .boilerplate/ | tar -xC ${join(upgradeDir, 'reference', 'source')}`, { encoding: 'utf-8', stdio: 'pipe' })
    execSync(`git archive --format=tar ${upgradePath.targetTag} .boilerplate/ | tar -xC ${join(upgradeDir, 'reference', 'target')}`, { encoding: 'utf-8', stdio: 'pipe' })
  }
  catch {
    console.log(`  ${colorize('⚠', 'yellow')} Could not extract reference files (tags may not exist)`)
  }

  // Copy checkpoint files if needed
  for (const cpId of upgradePath.checkpoints) {
    const cpFile = join(boilerplateDir, 'legacy-checkpoints', `${cpId}.md`)
    if (existsSync(cpFile)) {
      const destFile = join(upgradeDir, 'intentions', `${cpId}.md`)
      execSync(`cp "${cpFile}" "${destFile}"`, { encoding: 'utf-8' })
    }
  }

  const sessionPrompt = generateSessionPrompt(upgradePath, state)
  writeFileSync(join(upgradeDir, 'upgrade-session.md'), sessionPrompt, 'utf-8')

  const statusReport = generateStatusReport(upgradePath)
  writeFileSync(join(upgradeDir, 'status.md'), statusReport, 'utf-8')

  console.log(`  ${colorize('✓', 'green')} Created .boilerplate/upgrade/ workspace`)
  console.log(`  ${colorize('✓', 'green')} Generated upgrade-session.md`)
  console.log(`  ${colorize('✓', 'green')} Generated status.md`)
  console.log(`  ${colorize('→', 'cyan')} ${upgradePath.intentions.length} intentions ready for execution`)
  console.log()
}

function generateSessionPrompt(path: UpgradePath, state: BoilerplateState): string {
  const checkpointSection = path.checkpoints.length > 0
    ? `## Legacy Checkpoints

${path.checkpoints.map(c => `- ${c}`).join('\n')}

Checkpoint files are in \`.boilerplate/upgrade/intentions/\` as \`<checkpoint-id>.md\`.

`
    : ''

  return `# Upgrade Session: v${path.sourceVersion} → v${path.targetVersion}

## Instructions

You are an AI agent tasked with applying boilerplate upgrade intentions to this project.

### Rules

1. Work **one intention at a time**
2. Read each intention file before starting
3. Run applicability checks from the intention
4. **Stop** if a "Do not apply when" condition matches
5. Compare project files with boilerplate references when useful
6. Apply the **smallest safe change** needed
7. **Preserve** all project-specific behavior
8. Run validation after each intention
9. Update \`boilerplate.json\` after successful validation
10. **Stop** on unsafe ambiguity and write a blocked report

### Git Policy

- Create one commit per resolved intention
- Never rewrite divergent files wholesale
- Never apply cosmetic alignment unless required
- Do not mark an intention as applied before validation passes
- If not applicable, record as skipped with a reason

${checkpointSection}## Pending Intentions

${path.intentions.map(i => `- [ ] ${i.id}`).join('\n')}

## Project State

- Source version: v${path.sourceVersion}
- Target version: v${path.targetVersion}
- Tracked domains: ${state.trackedDomains.join(', ')}
- Applied intentions: ${state.intentions.applied.length}
- Skipped intentions: ${state.intentions.skipped.length}

## Reference Files

- Source reference: \`.boilerplate/upgrade/reference/source/\`
- Target reference: \`.boilerplate/upgrade/reference/target/\`
- Intention files: \`.boilerplate/upgrade/intentions/\`

Begin with the first intention.
`
}

function generateStatusReport(path: UpgradePath): string {
  return `# Upgrade Status

## Path

- Source: v${path.sourceVersion}
- Target: v${path.targetVersion}
- Releases: ${path.releases.join(', ')}
- Checkpoints: ${path.checkpoints.length > 0 ? path.checkpoints.join(', ') : 'none'}

## Intentions

### Pending (${path.intentions.length})

${path.intentions.map(i => `- ${i.id}`).join('\n')}

### Applied

_none_

### Skipped

_none_

### Blocked

_none_

## Status

**Ready** - Awaiting agent execution
`
}

async function cmdReleaseDraft(from: string, to: string, next: string): Promise<void> {
  console.log(`\n${colorize('📝 Generating Release Draft', 'cyan')}\n`)
  console.log(`  ${colorize('From:', 'dim')} ${from}`)
  console.log(`  ${colorize('To:', 'dim')} ${to}`)
  console.log(`  ${colorize('Next version:', 'dim')} ${next}`)

  const diff = runGitCommand(['diff', '--stat', `${from}..${to}`])
  const log = runGitCommand(['log', '--oneline', `${from}..${to}`])

  const releaseDir = join(boilerplateDir, 'migration-intentions', `v${next}`)
  mkdirSync(releaseDir, { recursive: true })

  const indexContent = `# Migration Intentions - v${next}

## Index

<!-- Review and populate with generated intentions -->

## Classification

<!-- Review classification.md for change summary -->
`
  writeFileSync(join(releaseDir, 'index.md'), indexContent, 'utf-8')

  const classificationContent = `# Change Classification - v${next}

## Analysis Required

Review the following changes and classify each:

\`\`\`
${diff}
\`\`\`

### Recent Commits

\`\`\`
${log}
\`\`\`

## Categories

- \`no migration\`: No effect on consumer projects
- \`informational\`: Useful context, no action required
- \`migration intention\`: Transferable evolution
- \`breaking/manual\`: Requires human decision
`
  writeFileSync(join(releaseDir, 'classification.md'), classificationContent, 'utf-8')

  console.log(`\n  ${colorize('✓', 'green')} Created draft artifacts in ${colorize(`.boilerplate/migration-intentions/v${next}/`, 'dim')}`)
  console.log(`  ${colorize('→', 'cyan')} Review and edit generated files before tagging`)
  console.log()
}

function printUsage(): void {
  console.log(`
${colorize('🪨  Boilerplate CLI', 'bright')}

${colorize('Usage:', 'cyan')}
  boilerplate <command> [options]

${colorize('Commands:', 'cyan')}

  ${colorize('versions list', 'bright')}              List available boilerplate versions
  ${colorize('upgrade init', 'bright')}               Initialize boilerplate tracking for a project
  ${colorize('upgrade path', 'bright')}               Show upgrade path to target version
  ${colorize('upgrade prepare', 'bright')}            Prepare local upgrade context
  ${colorize('upgrade status', 'bright')}             Show current upgrade status
  ${colorize('release draft', 'bright')}              Generate release draft artifacts

${colorize('Examples:', 'cyan')}

  ${colorize('boilerplate versions list', 'dim')}
  ${colorize('boilerplate upgrade init --project ./my-project', 'dim')}
  ${colorize('boilerplate upgrade path --from 1.0.0 --to 1.5.0', 'dim')}
  ${colorize('boilerplate upgrade prepare --project ./my-project --to 1.5.0', 'dim')}
  ${colorize('boilerplate upgrade status --project ./my-project', 'dim')}
  ${colorize('boilerplate release draft --from v1.4.0 --to HEAD --next 1.5.0', 'dim')}
`)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    printUsage()
    process.exit(0)
  }

  const command = args[0]
  const subcommand = args[1]

  try {
    if (command === 'versions') {
      if (subcommand === 'list') {
        cmdVersionsList()
      }
      else {
        printUsage()
      }
    }
    else if (command === 'upgrade') {
      const fromIndex = args.indexOf('--from')
      const toIndex = args.indexOf('--to')
      const projectIndex = args.indexOf('--project')

      const from = fromIndex !== -1 ? args[fromIndex + 1] : undefined
      const to = toIndex !== -1 ? args[toIndex + 1] : undefined
      const project = projectIndex !== -1 ? args[projectIndex + 1] : '.'

      if (subcommand === 'init') {
        cmdUpgradeInit(project)
      }
      else if (subcommand === 'path') {
        if (!to) {
          console.error(`  ${colorize('❌', 'red')} --to is required`)
          process.exit(1)
        }
        cmdUpgradePath(from || '', to, project)
      }
      else if (subcommand === 'prepare') {
        if (!to) {
          console.error(`  ${colorize('❌', 'red')} --to is required`)
          process.exit(1)
        }
        await cmdUpgradePrepare(project, to)
      }
      else if (subcommand === 'status') {
        cmdUpgradeStatus(project)
      }
      else {
        printUsage()
      }
    }
    else if (command === 'release') {
      if (subcommand === 'draft') {
        const fromIndex = args.indexOf('--from')
        const toIndex = args.indexOf('--to')
        const nextIndex = args.indexOf('--next')

        const from = fromIndex !== -1 ? args[fromIndex + 1] : undefined
        const to = toIndex !== -1 ? args[toIndex + 1] : undefined
        const next = nextIndex !== -1 ? args[nextIndex + 1] : undefined

        if (!from || !to || !next) {
          console.error(`  ${colorize('❌', 'red')} --from, --to, and --next are required`)
          process.exit(1)
        }

        await cmdReleaseDraft(from, to, next)
      }
      else {
        printUsage()
      }
    }
    else {
      printUsage()
    }
  }
  catch (error) {
    console.error(`\n${colorize('❌ Error:', 'red')} ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

main()
