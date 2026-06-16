import type {
  CheckpointInfo,
  IntentionFileInput,
  MigrationIntention,
  ReleaseInfo,
  UpgradePath,
} from './boilerplate-core'
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import Enquirer from 'enquirer'
import { colorize } from '../../cli/utils'
import {
  computeUpgradePath,
  getUpgradeBranchName,
  readOptionValue,
} from './boilerplate-core'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..', '..')
const boilerplateDir = join(projectRoot, '.boilerstone')

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

function prompt(message: string, initial: string): Promise<string> {
  const input = new Input({ message, initial })
  return input.run()
}

function _confirm(message: string): Promise<boolean> {
  const confirmPrompt = new Confirm({ name: 'confirm', message, initial: false })
  return confirmPrompt.run()
}

function getProjectPath(projectPath: string): string {
  return isAbsolute(projectPath) ? projectPath : resolve(process.cwd(), projectPath)
}

function runGitCommand(args: string[], cwd = projectRoot): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8' }).trim()
}

function archiveGitReference(reference: string, destination: string, cwd = projectRoot): void {
  // --output avoids buffering the archive on stdout (execFileSync caps stdout at 1MB by default)
  const tarFile = join(destination, '.reference.tar')
  execFileSync('git', ['archive', '--format=tar', `--output=${tarFile}`, reference, '.boilerstone/'], { cwd })
  execFileSync('tar', ['-xf', tarFile, '-C', destination])
  rmSync(tarFile, { force: true })
}

function gitFileExists(reference: string, filePath: string): boolean {
  try {
    runGitCommand(['cat-file', '-e', `${reference}:${filePath}`])
    return true
  }
  catch {
    return false
  }
}

function listGitMarkdownFiles(reference: string, directory: string): string[] {
  try {
    const output = runGitCommand(['ls-tree', '-r', '--name-only', reference, '--', directory])
    return output.split('\n').filter(file => file.endsWith('.md')).sort()
  }
  catch {
    return []
  }
}

function readGitFile(reference: string, filePath: string): string {
  return execFileSync('git', ['show', `${reference}:${filePath}`], { cwd: projectRoot, encoding: 'utf-8' })
}

function listMarkdownFiles(directory: string, recursive = false): string[] {
  if (!existsSync(directory)) {
    return []
  }

  const files: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory() && recursive) {
      files.push(...listMarkdownFiles(entryPath, true))
      continue
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(entryPath)
    }
  }

  return files.sort()
}

function ensureUpgradeBranch(workDir: string, branchName: string): void {
  const currentBranch = runGitCommand(['branch', '--show-current'], workDir)
  if (currentBranch === branchName) {
    return
  }

  const existingBranch = runGitCommand(['branch', '--list', branchName], workDir)
  if (existingBranch) {
    throw new Error(`Branch ${branchName} already exists. Check it out before preparing the upgrade.`)
  }

  runGitCommand(['checkout', '-b', branchName], workDir)
}

function getReleases(): ReleaseInfo[] {
  const tags = runGitCommand(['tag', '--list', 'v*', '--sort=-v:refname'])
  if (!tags) {
    return []
  }

  return tags.split('\n').filter(Boolean).map((tag) => {
    const version = tag.replace(/^v/, '')
    const date = runGitCommand(['log', '-1', '--format=%ci', tag]).split(' ')[0]
    // Intentions for a release live in its git tag: a consumer forked at an older
    // version does not have the newer files on disk. Disk is the fallback for
    // releases drafted in the boilerplate repo but not tagged yet.
    const hasMigrations = gitFileExists(tag, `.boilerstone/migration-intentions/${tag}/README.md`)
      || existsSync(join(boilerplateDir, 'migration-intentions', tag, 'README.md'))
    return {
      version,
      tag,
      date,
      hasMigrations,
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
  const boilerplateJsonPath = join(projectPath, '.boilerstone', 'boilerplate.json')
  if (!existsSync(boilerplateJsonPath)) {
    return null
  }

  const content = readFileSync(boilerplateJsonPath, 'utf-8')
  return JSON.parse(content) as BoilerplateState
}

function writeBoilerplateJson(projectPath: string, state: BoilerplateState): void {
  mkdirSync(join(projectPath, '.boilerstone'), { recursive: true })
  const boilerplateJsonPath = join(projectPath, '.boilerstone', 'boilerplate.json')
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

async function cmdUpgradeInit(projectPath: string): Promise<void> {
  console.log(`\n${colorize('🔧 Initializing Boilerplate Tracking', 'cyan')}\n`)

  const absolutePath = getProjectPath(projectPath)

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

  const sourceVersion = await prompt('Enter source boilerplate version', version)
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
}

function getCheckpoints(): CheckpointInfo[] {
  const checkpointsDir = join(boilerplateDir, 'legacy-checkpoints')
  if (!existsSync(checkpointsDir)) {
    return []
  }

  return listMarkdownFiles(checkpointsDir)
    .filter(f => !f.endsWith('TEMPLATE.md') && !f.endsWith('README.md'))
    .map((file) => {
      const id = basename(file).replace('.md', '')
      const parts = id.split('-to-')
      return { id, targetVersion: parts[1] || '', minSourceVersion: parts[1] ? '0.0.0' : '', file }
    })
}

function formatIntentionListItem(intention: MigrationIntention): string {
  const domain = intention.domain ? ` [${intention.domain}]` : ''
  const metadataIssues = intention.metadataIssues.length > 0
    ? colorize(` metadata: ${intention.metadataIssues.join(', ')}`, 'yellow')
    : ''

  return `${colorize('•', 'cyan')} ${colorize(intention.id, 'bright')}${domain}${metadataIssues}`
}

function getMetadataIssueCount(intentions: MigrationIntention[]): number {
  return intentions.filter(intention => intention.metadataIssues.length > 0).length
}

function formatCountList(counts: Record<string, number>): string {
  const entries = Object.entries(counts).filter(([, count]) => count > 0)
  if (entries.length === 0) {
    return '_none_'
  }

  return entries.map(([name, count]) => `- ${name}: ${count}`).join('\n')
}

function formatIntentionStatusItem(intention: MigrationIntention): string {
  const domain = intention.domain || 'unknown-domain'
  return `- ${intention.id} (${domain}, ${intention.classification})`
}

function formatIntentionPromptItem(intention: MigrationIntention): string {
  const stopFirst = intention.classification === 'breaking-manual' ? ' - STOP FIRST: requires human decision before edits' : ''
  return `- [ ] ${intention.id} (${intention.classification})${stopFirst}`
}

function formatMetadataWarnings(intentions: MigrationIntention[]): string {
  const intentionsWithIssues = intentions.filter(intention => intention.metadataIssues.length > 0)
  if (intentionsWithIssues.length === 0) {
    return '_none_'
  }

  return intentionsWithIssues
    .map(intention => `- ${intention.id}: ${intention.metadataIssues.join(', ')}`)
    .join('\n')
}

function getIntentionFiles(releases: ReleaseInfo[]): IntentionFileInput[] {
  return releases.flatMap((release) => {
    // Git tag first: consumers forked before this release only have it in git
    const releaseDirInGit = `.boilerstone/migration-intentions/v${release.version}`
    if (gitFileExists(release.tag, `${releaseDirInGit}/README.md`)) {
      return listGitMarkdownFiles(release.tag, releaseDirInGit)
        .filter(file => !file.endsWith('README.md') && !file.endsWith('classification.md'))
        .map(file => ({
          releaseVersion: release.version,
          file: `${release.tag}:${file}`,
          relativePath: file.slice(releaseDirInGit.length + 1),
          content: readGitFile(release.tag, file),
        }))
    }

    // Disk fallback: release drafted in the boilerplate repo but not tagged yet
    const releaseDir = join(boilerplateDir, 'migration-intentions', `v${release.version}`)
    const releaseReadme = join(releaseDir, 'README.md')
    if (!existsSync(releaseReadme)) {
      return []
    }

    return listMarkdownFiles(releaseDir, true)
      .filter(file => !file.endsWith('README.md') && !file.endsWith('classification.md'))
      .map(file => ({
        releaseVersion: release.version,
        file,
        relativePath: relative(releaseDir, file),
        content: readFileSync(file, 'utf-8'),
      }))
  })
}

function resolveUpgradePath(sourceVersion: string, targetVersion: string, trackedDomains: string[], appliedIntentions: string[], skippedIntentions: string[]): UpgradePath {
  const releases = getReleases()

  return computeUpgradePath({
    sourceVersion,
    targetVersion,
    trackedDomains,
    appliedIntentions,
    skippedIntentions,
    releases,
    checkpoints: getCheckpoints(),
    intentionFiles: getIntentionFiles(releases),
  })
}

function cmdUpgradePath(fromVersion: string, toVersion: string, projectPath: string, json = false): void {
  const absolutePath = projectPath ? getProjectPath(projectPath) : projectRoot
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
    console.error(`  ${colorize('→', 'cyan')} Run ${colorize(`boilerplate upgrade init --project ${projectPath}`, 'bright')} or pass ${colorize('--from <version>', 'bright')}`)
    process.exit(1)
  }

  const path = resolveUpgradePath(sourceVersion, toVersion, trackedDomains, appliedIntentions, skippedIntentions)
  const branchName = getUpgradeBranchName(path.sourceVersion, path.targetVersion)

  if (json) {
    console.log(JSON.stringify({ ...path, branchName }, null, 2))
    return
  }

  console.log(`\n${colorize('🛤️  Upgrade Path Resolution', 'cyan')}\n`)

  const migrationIntentions = path.intentions.filter(intention => intention.classification === 'migration')
  const breakingManualIntentions = path.intentions.filter(intention => intention.classification === 'breaking-manual')
  const metadataIssueCount = getMetadataIssueCount(path.intentions)

  console.log(`  ${colorize('Release range:', 'dim')} ${colorize(`v${path.sourceVersion} → v${path.targetVersion}`, 'bright')}`)
  console.log(`  ${colorize('Target branch:', 'dim')} ${colorize(branchName, 'bright')}`)
  console.log(`  ${colorize('Releases:', 'dim')} ${path.releases.length}`)
  console.log(`  ${colorize('Already applied/skipped:', 'dim')} ${path.alreadyResolvedCount}`)
  console.log(`  ${colorize('Migration intentions:', 'dim')} ${migrationIntentions.length}`)
  console.log(`  ${colorize('Breaking/manual intentions:', 'dim')} ${breakingManualIntentions.length}`)
  console.log(`  ${colorize('Metadata warnings:', 'dim')} ${metadataIssueCount}`)

  console.log(`\n  ${colorize('Counts by classification (whole range):', 'cyan')}\n`)
  console.log(formatCountList(path.classificationCounts).split('\n').map(line => `    ${line}`).join('\n'))

  console.log(`\n  ${colorize('Skipped by domain:', 'cyan')}\n`)
  console.log(formatCountList(path.skippedByDomain).split('\n').map(line => `    ${line}`).join('\n'))

  if (migrationIntentions.length > 0) {
    console.log(`\n  ${colorize('📋 Migration Intentions:', 'cyan')}\n`)
    for (const intention of migrationIntentions) {
      console.log(`    ${formatIntentionListItem(intention)}`)
    }
  }

  if (breakingManualIntentions.length > 0) {
    console.log(`\n  ${colorize('⚠ Breaking/manual Intentions:', 'yellow')}\n`)
    console.log(`    ${colorize('These require a human decision before edits.', 'yellow')}`)
    for (const intention of breakingManualIntentions) {
      console.log(`    ${formatIntentionListItem(intention)}`)
    }
  }

  console.log()
}

function cmdUpgradeStatus(projectPath: string, json = false): void {
  const absolutePath = projectPath ? getProjectPath(projectPath) : projectRoot
  const state = readBoilerplateJson(absolutePath)

  if (json) {
    console.log(JSON.stringify(state ? { initialized: true, ...state } : { initialized: false }, null, 2))
    return
  }

  console.log(`\n${colorize('📊 Boilerplate Upgrade Status', 'cyan')}\n`)

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

  const absolutePath = projectPath ? getProjectPath(projectPath) : projectRoot
  const state = readBoilerplateJson(absolutePath)

  if (!state) {
    console.error(`  ${colorize('❌', 'red')} No boilerplate.json found.`)
    console.error(`  ${colorize('→', 'cyan')} Run ${colorize(`boilerplate upgrade init --project ${projectPath}`, 'bright')} first.`)
    process.exit(1)
  }

  const dirtyOutput = runGitCommand(['status', '--porcelain'], absolutePath)
  if (dirtyOutput) {
    console.error(`  ${colorize('❌', 'red')} Git worktree is dirty. Clean before upgrading.`)
    console.error(`  ${colorize('→', 'cyan')} Inspect changes with ${colorize(`git -C ${absolutePath} status --short`, 'bright')}`)
    process.exit(1)
  }

  const upgradePath = resolveUpgradePath(
    state.source.currentVersion,
    toVersion,
    state.trackedDomains,
    state.intentions.applied.map(i => i.id),
    state.intentions.skipped.map(i => i.id),
  )

  const branchName = getUpgradeBranchName(upgradePath.sourceVersion, upgradePath.targetVersion)
  ensureUpgradeBranch(absolutePath, branchName)
  console.log(`  ${colorize('→', 'cyan')} Working on branch: ${colorize(branchName, 'bright')}`)

  const upgradeDir = join(absolutePath, '.boilerstone', 'upgrade')
  if (existsSync(upgradeDir)) {
    rmSync(upgradeDir, { recursive: true, force: true })
  }

  mkdirSync(join(upgradeDir, 'reference', 'source'), { recursive: true })
  mkdirSync(join(upgradeDir, 'reference', 'target'), { recursive: true })
  mkdirSync(join(upgradeDir, 'intentions'), { recursive: true })

  for (const intention of upgradePath.intentions) {
    // Content was resolved from the release git tag (or disk fallback); write it
    // instead of copying, since the source may not exist as a local file
    const destFile = join(upgradeDir, 'intentions', `${intention.id.replace(/\//g, '-')}.md`)
    writeFileSync(destFile, intention.content, 'utf-8')
  }

  // Extract reference files from git tags
  try {
    archiveGitReference(upgradePath.sourceTag, join(upgradeDir, 'reference', 'source'))
    archiveGitReference(upgradePath.targetTag, join(upgradeDir, 'reference', 'target'))
  }
  catch (error) {
    console.log(`  ${colorize('⚠', 'yellow')} Could not extract reference files from ${upgradePath.sourceTag} or ${upgradePath.targetTag}: ${error instanceof Error ? error.message : String(error)}`)
    console.log(`  ${colorize('→', 'cyan')} Those git references must exist locally. Fetch them with ${colorize('git fetch <boilerplate-remote> --tags', 'bright')}`)
  }

  // Copy checkpoint files if needed
  for (const cpId of upgradePath.checkpoints) {
    const cpFile = join(boilerplateDir, 'legacy-checkpoints', `${cpId}.md`)
    if (existsSync(cpFile)) {
      const destFile = join(upgradeDir, 'intentions', `${cpId}.md`)
      cpSync(cpFile, destFile)
    }
  }

  const sessionPrompt = generateSessionPrompt(upgradePath, state)
  writeFileSync(join(upgradeDir, 'upgrade-session.md'), sessionPrompt, 'utf-8')

  const statusReport = generateStatusReport(upgradePath)
  writeFileSync(join(upgradeDir, 'status.md'), statusReport, 'utf-8')

  console.log(`  ${colorize('✓', 'green')} Created .boilerstone/upgrade/ workspace`)
  console.log(`  ${colorize('✓', 'green')} Generated upgrade-session.md`)
  console.log(`  ${colorize('✓', 'green')} Generated status.md`)
  console.log(`  ${colorize('→', 'cyan')} ${upgradePath.intentions.length} intentions ready for execution`)
  console.log()
}

function generateSessionPrompt(path: UpgradePath, state: BoilerplateState): string {
  const checkpointSection = path.checkpoints.length > 0
    ? `## Legacy Checkpoints

${path.checkpoints.map(c => `- ${c}`).join('\n')}

Checkpoint files are in \`.boilerstone/upgrade/intentions/\` as \`<checkpoint-id>.md\`.

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
5. For \`breaking-manual\` intentions, **stop before editing files** and write a blocked report describing the required human decision
6. Compare project files with boilerplate references when useful
7. Apply the **smallest safe change** needed
8. **Preserve** all project-specific behavior
9. Run validation after each intention
10. Update \`boilerplate.json\` after successful validation
11. **Stop** on unsafe ambiguity and write a blocked report
12. After the last intention is resolved, set \`source.currentVersion\` to ${path.targetVersion} in \`boilerplate.json\`

### Git Policy

- Create one commit per resolved intention
- Never rewrite divergent files wholesale
- Never apply cosmetic alignment unless required
- Do not mark an intention as applied before validation passes
- If not applicable, record as skipped with a reason

${checkpointSection}## Pending Intentions

${path.intentions.map(formatIntentionPromptItem).join('\n')}

## Metadata Warnings

${formatMetadataWarnings(path.intentions)}

## Project State

- Source version: v${path.sourceVersion}
- Target version: v${path.targetVersion}
- Tracked domains: ${state.trackedDomains.join(', ')}
- Applied intentions: ${state.intentions.applied.length}
- Skipped intentions: ${state.intentions.skipped.length}

## Reference Files

- Source reference: \`.boilerstone/upgrade/reference/source/\`
- Target reference: \`.boilerstone/upgrade/reference/target/\`
- Intention files: \`.boilerstone/upgrade/intentions/\`

Begin with the first intention.
`
}

function generateStatusReport(path: UpgradePath): string {
  const migrationIntentions = path.intentions.filter(intention => intention.classification === 'migration')
  const breakingManualIntentions = path.intentions.filter(intention => intention.classification === 'breaking-manual')
  const branchName = getUpgradeBranchName(path.sourceVersion, path.targetVersion)

  return `# Upgrade Status

## Path

- Source: v${path.sourceVersion}
- Target: v${path.targetVersion}
- Branch: ${branchName}
- Releases: ${path.releases.join(', ')}
- Checkpoints: ${path.checkpoints.length > 0 ? path.checkpoints.join(', ') : 'none'}

## Summary

### Counts By Classification (Whole Range)

${formatCountList(path.classificationCounts)}

### Skipped By Domain

${formatCountList(path.skippedByDomain)}

### Already Applied Or Skipped

${path.alreadyResolvedCount}

## Intentions

### Migration (${migrationIntentions.length})

${migrationIntentions.map(formatIntentionStatusItem).join('\n') || '_none_'}

### Breaking/manual (${breakingManualIntentions.length})

These require a human decision before edits.

${breakingManualIntentions.map(formatIntentionStatusItem).join('\n') || '_none_'}

### Metadata Warnings (${getMetadataIssueCount(path.intentions)})

${formatMetadataWarnings(path.intentions)}

### Applied

_none_

### Skipped

_none_

### Blocked

_none_

## Status

**Ready** - Awaiting agent execution

## Next Steps

1. Read \`.boilerstone/upgrade/upgrade-session.md\`.
2. Apply or block one intention at a time.
3. Record applied, skipped, and blocked outcomes in \`.boilerstone/boilerplate.json\` and this report.
4. Run the validation listed by each intention before marking it applied.
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

  const readmeContent = `# Migration Intentions - v${next}

## Intentions

<!-- Review and populate with generated intentions -->

## Classification

<!-- Review classification.md for change summary -->
`
  writeFileSync(join(releaseDir, 'README.md'), readmeContent, 'utf-8')

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

  console.log(`\n  ${colorize('✓', 'green')} Created draft artifacts in ${colorize(`.boilerstone/migration-intentions/v${next}/`, 'dim')}`)
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

${colorize('Options:', 'cyan')}

  ${colorize('--project <path>', 'bright')}           Consumer project to operate on (default: this repository)
  ${colorize('--json', 'bright')}                     Machine-readable output for ${colorize('upgrade status', 'dim')} and ${colorize('upgrade path', 'dim')}

${colorize('Examples:', 'cyan')}

  ${colorize('boilerplate versions list', 'dim')}
  ${colorize('boilerplate upgrade init --project ./my-project', 'dim')}
  ${colorize('boilerplate upgrade path --from 1.0.0 --to 1.5.0', 'dim')}
  ${colorize('boilerplate upgrade prepare --project ./my-project --to 1.5.0', 'dim')}
  ${colorize('boilerplate upgrade status --project ./my-project --json', 'dim')}
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
      const from = readOptionValue(args, '--from')
      const to = readOptionValue(args, '--to')
      const project = readOptionValue(args, '--project') || '.'
      const json = args.includes('--json')

      if (subcommand === 'init') {
        await cmdUpgradeInit(project)
      }
      else if (subcommand === 'path') {
        if (!to) {
          console.error(`  ${colorize('❌', 'red')} --to is required`)
          process.exit(1)
        }
        cmdUpgradePath(from || '', to, project, json)
      }
      else if (subcommand === 'prepare') {
        if (!to) {
          console.error(`  ${colorize('❌', 'red')} --to is required`)
          process.exit(1)
        }
        await cmdUpgradePrepare(project, to)
      }
      else if (subcommand === 'status') {
        cmdUpgradeStatus(project, json)
      }
      else {
        printUsage()
      }
    }
    else if (command === 'release') {
      if (subcommand === 'draft') {
        const from = readOptionValue(args, '--from')
        const to = readOptionValue(args, '--to')
        const next = readOptionValue(args, '--next')

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

// Run only when invoked as a script, so tests can import the helpers below
const isDirectExecution = process.argv[1] ? resolve(process.argv[1]) === __filename : false
if (isDirectExecution) {
  main()
}

export { archiveGitReference }
