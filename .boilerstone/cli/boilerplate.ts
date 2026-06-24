import type {
  IntentionFileInput,
  MigrationIntention,
  ReleaseInfo,
  UpgradePath,
} from './boilerplate-core'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import Enquirer from 'enquirer'
import { colorize } from '../../cli/utils'
import {
  compareVersions,
  computeUpgradePath,
  getUpgradeBranchName,
  readOptionValue,
} from './boilerplate-core'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..', '..')
const boilerplateDir = join(projectRoot, '.boilerstone')
const defaultBoilerplateRemote = 'https://github.com/lonestone/lonestone-boilerplate.git'

interface InputPromptOptions {
  message: string
  initial?: string
}

interface InputPrompt {
  run: () => Promise<string>
}

interface EnquirerConstructors {
  Input: new (options: InputPromptOptions) => InputPrompt
}

const { Input } = Enquirer as unknown as EnquirerConstructors

interface BoilerplateState {
  schemaVersion: number
  source: {
    repository: string
    remote?: string
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

function getProjectPath(projectPath: string): string {
  return isAbsolute(projectPath) ? projectPath : resolve(process.cwd(), projectPath)
}

function getGitEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  delete env.GIT_DIR
  delete env.GIT_WORK_TREE
  return env
}

function runGitCommand(args: string[], cwd = projectRoot): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    env: getGitEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function getBoilerplateRemote(state: BoilerplateState | null): string {
  return state?.source.remote || defaultBoilerplateRemote
}

function normalizeGitRemote(value: string): string {
  return value
    .trim()
    .replace(/^git@github\.com:/, 'https://github.com/')
    .replace(/^ssh:\/\/git@github\.com\//, 'https://github.com/')
    .replace(/\/$/, '')
    .replace(/\.git$/, '')
    .toLowerCase()
}

interface GitRemote {
  name: string
  url: string
}

function getGitRemotes(cwd = projectRoot): GitRemote[] {
  try {
    const remotes = runGitCommand(['remote', '-v'], cwd)
    if (!remotes) {
      return []
    }

    return remotes
      .split('\n')
      .map((line) => {
        const [name, url] = line.trim().split(/\s+/)
        return name && url ? { name, url } : null
      })
      .filter((remote): remote is GitRemote => Boolean(remote))
  }
  catch {
    return []
  }
}

function getRemoteNameForUrl(remoteUrl: string, cwd = projectRoot): string | undefined {
  const expectedRemote = normalizeGitRemote(remoteUrl)
  return getGitRemotes(cwd).find(remote => normalizeGitRemote(remote.url) === expectedRemote)?.name
}

function hasRemoteUrl(remoteUrl: string, cwd = projectRoot): boolean {
  return Boolean(getRemoteNameForUrl(remoteUrl, cwd))
}

function getFetchTagsCommand(remoteUrl: string, cwd = projectRoot): string {
  const remoteName = getRemoteNameForUrl(remoteUrl, cwd)
  if (remoteName) {
    return `git fetch ${remoteName} --tags`
  }

  return `git remote add boilerplate ${remoteUrl}\ngit fetch boilerplate --tags`
}

function printMissingReleaseTags(state: BoilerplateState | null): void {
  const remoteUrl = getBoilerplateRemote(state)
  console.error(`  ${colorize('❌', 'red')} No local boilerplate release tags found.`)
  console.error(`  ${colorize('→', 'cyan')} Fetch the boilerplate release tags first:`)
  for (const command of getFetchTagsCommand(remoteUrl).split('\n')) {
    console.error(`    ${colorize(command, 'bright')}`)
  }
}

function archiveGitReference(reference: string, destination: string, cwd = projectRoot): void {
  // --output avoids buffering the archive on stdout (execFileSync caps stdout at 1MB by default)
  const tarFile = join(destination, '.reference.tar')
  execFileSync('git', ['archive', '--format=tar', `--output=${tarFile}`, reference, '.boilerstone/'], { cwd, env: getGitEnv() })
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
  return execFileSync('git', ['show', `${reference}:${filePath}`], { cwd: projectRoot, encoding: 'utf-8', env: getGitEnv() })
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

function getGitTagNames(): string[] {
  let tags = ''
  try {
    tags = runGitCommand(['tag', '--list', 'v*', '--sort=-v:refname'])
  }
  catch {
    return []
  }

  if (!tags) {
    return []
  }

  return tags.split('\n').filter(Boolean)
}

function getDiskReleaseInfos(): ReleaseInfo[] {
  const intentionsDir = join(boilerplateDir, 'migration-intentions')
  if (!existsSync(intentionsDir)) {
    return []
  }

  return readdirSync(intentionsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^v\d+\.\d+\.\d+$/.test(entry.name))
    .filter(entry => existsSync(join(intentionsDir, entry.name, 'README.md')))
    .map((entry) => {
      const version = entry.name.replace(/^v/, '')
      return {
        version,
        tag: entry.name,
        date: 'local-draft',
        hasMigrations: true,
      }
    })
}

function getBoilerplateGitTagNames(): string[] {
  return getGitTagNames().filter(tag => gitFileExists(tag, '.boilerstone/README.md'))
}

function getReleases(): ReleaseInfo[] {
  const releasesByVersion = new Map<string, ReleaseInfo>()

  for (const tag of getGitTagNames()) {
    const hasBoilerplateFiles = gitFileExists(tag, '.boilerstone/README.md')
    const hasDiskRelease = existsSync(join(boilerplateDir, 'migration-intentions', tag, 'README.md'))
    if (!hasBoilerplateFiles && !hasDiskRelease) {
      continue
    }

    const version = tag.replace(/^v/, '')
    const date = runGitCommand(['log', '-1', '--format=%ci', tag]).split(' ')[0]
    // Intentions for a release live in its git tag: a consumer forked at an older
    // version does not have the newer files on disk. Disk is the fallback for
    // releases drafted in the boilerplate repo but not tagged yet.
    const hasMigrations = gitFileExists(tag, `.boilerstone/migration-intentions/${tag}/README.md`)
      || existsSync(join(boilerplateDir, 'migration-intentions', tag, 'README.md'))
    releasesByVersion.set(version, {
      version,
      tag,
      date,
      hasMigrations,
    })
  }

  for (const release of getDiskReleaseInfos()) {
    if (!releasesByVersion.has(release.version)) {
      releasesByVersion.set(release.version, release)
    }
  }

  return [...releasesByVersion.values()].sort((a, b) => compareVersions(b.version, a.version))
}

function cmdVersionsList(): void {
  console.log(`\n${colorize('📦 Available Boilerplate Versions', 'cyan')}\n`)

  const releases = getReleases()
  if (releases.length === 0) {
    console.log(`  ${colorize('⚠', 'yellow')} No releases found`)
    console.log(`  ${colorize('→', 'cyan')} Fetch boilerplate release tags first:`)
    for (const command of getFetchTagsCommand(defaultBoilerplateRemote).split('\n')) {
      console.log(`    ${colorize(command, 'bright')}`)
    }
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
    console.log(`  ${colorize('Remote:', 'dim')} ${getBoilerplateRemote(existing)}`)
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
      remote: defaultBoilerplateRemote,
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
  console.log(`  ${colorize('Remote:', 'dim')} ${defaultBoilerplateRemote}`)
  console.log(`  ${colorize('Source version:', 'dim')} ${sourceVersion}`)
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

function resolveUpgradePath(sourceVersion: string, targetVersion: string, trackedDomains: string[], appliedIntentions: string[], skippedIntentions: string[], releases = getReleases()): UpgradePath {
  return computeUpgradePath({
    sourceVersion,
    targetVersion,
    trackedDomains,
    appliedIntentions,
    skippedIntentions,
    releases,
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

  const releases = getReleases()
  if (releases.length === 0) {
    printMissingReleaseTags(state)
    process.exit(1)
  }

  const path = resolveUpgradePath(sourceVersion, toVersion, trackedDomains, appliedIntentions, skippedIntentions, releases)
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
  console.log(`  ${colorize('Remote:', 'dim')} ${getBoilerplateRemote(state)}`)
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

interface DoctorCheck {
  name: string
  status: 'passed' | 'warning' | 'failed'
  message: string
  suggestion?: string
}

interface DoctorReport {
  projectPath: string
  initialized: boolean
  checks: DoctorCheck[]
  summary: {
    passed: number
    warnings: number
    failed: number
  }
}

function createDoctorReport(projectPath: string): DoctorReport {
  const checks: DoctorCheck[] = []
  const state = readBoilerplateJson(projectPath)

  checks.push(state
    ? {
        name: 'boilerplate.json',
        status: 'passed',
        message: `Tracking initialized at v${state.source.currentVersion}`,
      }
    : {
        name: 'boilerplate.json',
        status: 'failed',
        message: 'Missing .boilerstone/boilerplate.json',
        suggestion: 'Run pnpm boilerplate upgrade init --project <path>',
      })

  try {
    const dirtyOutput = runGitCommand(['status', '--porcelain'], projectPath)
    checks.push(dirtyOutput
      ? {
          name: 'git worktree',
          status: 'warning',
          message: 'Worktree has uncommitted changes',
          suggestion: 'Commit or intentionally set aside local changes before upgrade prepare',
        }
      : {
          name: 'git worktree',
          status: 'passed',
          message: 'Worktree is clean',
        })
  }
  catch {
    checks.push({
      name: 'git worktree',
      status: 'failed',
      message: 'Project path is not a readable git worktree',
    })
  }

  const remoteUrl = getBoilerplateRemote(state)
  checks.push(hasRemoteUrl(remoteUrl)
    ? {
        name: 'boilerplate remote',
        status: 'passed',
        message: `Remote configured for ${remoteUrl}`,
      }
    : {
        name: 'boilerplate remote',
        status: 'warning',
        message: `No git remote found for ${remoteUrl}`,
        suggestion: getFetchTagsCommand(remoteUrl),
      })

  const boilerplateGitTags = getBoilerplateGitTagNames()
  checks.push(boilerplateGitTags.length > 0
    ? {
        name: 'release tags',
        status: 'passed',
        message: `${boilerplateGitTags.length} boilerplate release tag(s) available`,
      }
    : {
        name: 'release tags',
        status: 'failed',
        message: 'No local boilerplate release tags found',
        suggestion: getFetchTagsCommand(remoteUrl),
      })

  if (state && boilerplateGitTags.length > 0) {
    const sourceTag = `v${state.source.currentVersion.replace(/^v/, '')}`
    checks.push(boilerplateGitTags.includes(sourceTag)
      ? {
          name: 'current version tag',
          status: 'passed',
          message: `${sourceTag} is available locally`,
        }
      : {
          name: 'current version tag',
          status: 'warning',
          message: `${sourceTag} is not available locally`,
          suggestion: getFetchTagsCommand(remoteUrl),
        })
  }

  const producerArtifacts = [
    '.boilerstone/migration-intentions',
    '.boilerstone/docs/ai-upgrades-implementation.md',
    '.boilerstone/docs/pilot-rollout.md',
  ].filter(file => existsSync(join(projectPath, file)))

  checks.push(producerArtifacts.length === 0
    ? {
        name: 'consumer cleanup',
        status: 'passed',
        message: 'No producer-only upgrade artifacts found',
      }
    : {
        name: 'consumer cleanup',
        status: 'warning',
        message: `Producer-only artifacts are present: ${producerArtifacts.join(', ')}`,
        suggestion: 'This is expected in the boilerplate repository; generated projects should run pnpm rock cleanup',
      })

  return {
    projectPath,
    initialized: Boolean(state),
    checks,
    summary: {
      passed: checks.filter(check => check.status === 'passed').length,
      warnings: checks.filter(check => check.status === 'warning').length,
      failed: checks.filter(check => check.status === 'failed').length,
    },
  }
}

function formatDoctorIcon(status: DoctorCheck['status']): string {
  if (status === 'passed') {
    return colorize('✓', 'green')
  }

  if (status === 'warning') {
    return colorize('⚠', 'yellow')
  }

  return colorize('✗', 'red')
}

function cmdUpgradeDoctor(projectPath: string, json = false): void {
  const absolutePath = projectPath ? getProjectPath(projectPath) : projectRoot
  const report = createDoctorReport(absolutePath)

  if (json) {
    console.log(JSON.stringify(report, null, 2))
    if (report.summary.failed > 0) {
      process.exit(1)
    }
    return
  }

  console.log(`\n${colorize('🩺 Boilerplate Upgrade Doctor', 'cyan')}\n`)
  console.log(`  ${colorize('Project:', 'dim')} ${absolutePath}`)

  for (const check of report.checks) {
    console.log(`  ${formatDoctorIcon(check.status)} ${colorize(check.name, 'bright')}: ${check.message}`)
    if (check.suggestion) {
      for (const command of check.suggestion.split('\n')) {
        console.log(`    ${colorize('→', 'cyan')} ${colorize(command, 'dim')}`)
      }
    }
  }

  console.log(`\n  ${colorize('Summary:', 'bright')} ${report.summary.passed} passed, ${report.summary.warnings} warning(s), ${report.summary.failed} failed\n`)

  if (report.summary.failed > 0) {
    process.exit(1)
  }
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

  const releases = getReleases()
  if (releases.length === 0) {
    printMissingReleaseTags(state)
    process.exit(1)
  }

  const upgradePath = resolveUpgradePath(
    state.source.currentVersion,
    toVersion,
    state.trackedDomains,
    state.intentions.applied.map(i => i.id),
    state.intentions.skipped.map(i => i.id),
    releases,
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

  const sessionPrompt = generateSessionPrompt(upgradePath, state)
  writeFileSync(join(upgradeDir, 'upgrade-session.md'), sessionPrompt, 'utf-8')

  console.log(`  ${colorize('✓', 'green')} Created .boilerstone/upgrade/ workspace`)
  console.log(`  ${colorize('✓', 'green')} Generated upgrade-session.md`)
  console.log(`  ${colorize('→', 'cyan')} ${upgradePath.intentions.length} intentions ready for execution`)
  console.log()
}

function generateSessionPrompt(path: UpgradePath, state: BoilerplateState): string {
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

## Pending Intentions

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

function printUsage(): void {
  console.log(`
${colorize('🪨  Boilerplate CLI', 'bright')}

${colorize('Usage:', 'cyan')}
  boilerplate <command> [options]

${colorize('Commands:', 'cyan')}

  ${colorize('versions list', 'bright')}              List available boilerplate versions
  ${colorize('upgrade init', 'bright')}               Initialize boilerplate tracking for a project
  ${colorize('upgrade doctor', 'bright')}             Diagnose upgrade readiness
  ${colorize('upgrade path', 'bright')}               Show upgrade path to target version
  ${colorize('upgrade prepare', 'bright')}            Prepare local upgrade context
  ${colorize('upgrade status', 'bright')}             Show current upgrade status
${colorize('Options:', 'cyan')}

  ${colorize('--project <path>', 'bright')}           Consumer project to operate on (default: this repository)
  ${colorize('--json', 'bright')}                     Machine-readable output for ${colorize('upgrade status', 'dim')} and ${colorize('upgrade path', 'dim')}

${colorize('Examples:', 'cyan')}

  ${colorize('boilerplate versions list', 'dim')}
  ${colorize('boilerplate upgrade init --project ./my-project', 'dim')}
  ${colorize('boilerplate upgrade doctor --project ./my-project', 'dim')}
  ${colorize('boilerplate upgrade path --from 1.0.0 --to 1.5.0', 'dim')}
  ${colorize('boilerplate upgrade prepare --project ./my-project --to 1.5.0', 'dim')}
  ${colorize('boilerplate upgrade status --project ./my-project --json', 'dim')}`)
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
      else if (subcommand === 'doctor') {
        cmdUpgradeDoctor(project, json)
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
