import type {
  IntentionFileInput,
  MigrationIntention,
  PackageJsonShape,
  ReleaseInfo,
  UpgradePath,
} from './boilerplate-core'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import {
  compareVersions,
  computeUpgradePath,
  ensureGitignoreLine,
  ensurePackageJsonWiring,
  getFallbackIntentionId,
  getIntentionOrderIssues,
  getUpgradeBranchName,
  parseIntentionMetadataContent,
  parseReferencePaths,
  PRODUCER_ARTIFACTS,
  readOptionValue,
  resolveTargetVersion,
} from './boilerplate-core'
import { colorize, isolatedGitEnv } from './utils'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..', '..')
const boilerplateDir = join(projectRoot, '.boilerstone')
const defaultBoilerplateRemote = 'https://github.com/lonestone/lonestone-boilerplate.git'
// Pinned to match the boilerplate's own tsx version; used when wiring a consumer's package.json.
const defaultTsxVersion = '^4.21.0'

interface BoilerplateState {
  schemaVersion: number
  source: {
    repository: string
    remote?: string
    currentVersion: string
    commit?: string
  }
  trackedDomains: string[]
  intentions: {
    applied: Array<{ id: string; appliedAt: string }>
    skipped: Array<{ id: string; reason: string }>
  }
}

async function prompt(message: string, initial: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await rl.question(`${message}${initial ? ` (${initial})` : ''}: `)
    return answer.trim() || initial
  } finally {
    rl.close()
  }
}

function getProjectPath(projectPath: string): string {
  return isAbsolute(projectPath) ? projectPath : resolve(process.cwd(), projectPath)
}

function runGitCommand(args: string[], cwd = projectRoot): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    env: isolatedGitEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function getConfiguredBoilerplateRemote(): string {
  return process.env.BOILERPLATE_REPO?.trim() || defaultBoilerplateRemote
}

function getBoilerplateRemote(state: BoilerplateState | null): string {
  return state?.source.remote || getConfiguredBoilerplateRemote()
}

// Boilerplate releases are fetched into a dedicated ref namespace instead of
// refs/tags: consumer projects version their own app with their own v* tags,
// and the two must never collide (or worse, overwrite each other).
const RELEASE_REF_PREFIX = 'refs/boilerstone/'
const RELEASE_FETCH_REFSPEC = '+refs/tags/v*:refs/boilerstone/v*'

function getFetchReleasesCommand(remoteUrl: string): string {
  return `git fetch --no-tags ${remoteUrl} "${RELEASE_FETCH_REFSPEC}"`
}

// Resolves a release tag name (v1.0.0) to the ref that actually holds it:
// the namespaced ref in a consumer project, the plain tag in the boilerplate
// checkout itself.
function releaseRef(tag: string, cwd = projectRoot): string {
  try {
    runGitCommand(['rev-parse', '--verify', '--quiet', `${RELEASE_REF_PREFIX}${tag}`], cwd)
    return `${RELEASE_REF_PREFIX}${tag}`
  } catch {
    return tag
  }
}

function printMissingReleaseTags(state: BoilerplateState | null, _cwd = projectRoot): void {
  const remoteUrl = getBoilerplateRemote(state)
  console.error(`  ${colorize('❌', 'red')} No local boilerplate releases found.`)
  console.error(`  ${colorize('→', 'cyan')} Fetch the boilerplate releases first:`)
  console.error(`    ${colorize(getFetchReleasesCommand(remoteUrl), 'bright')}`)
}

// Fetch the boilerplate release tags straight from the remote URL, without adding
// a persistent git remote, into the refs/boilerstone/ namespace so they can never
// collide with the consumer's own version tags. The `+` in the refspec follows a
// moved release tag (pre-release retags). With `required: false` a failure
// (offline, bad URL) degrades to the locally available releases.
function fetchBoilerplateReleases(
  absolutePath: string,
  state: BoilerplateState | null,
  { required }: { required: boolean },
): void {
  const remoteUrl = getBoilerplateRemote(state)
  console.log(`  ${colorize('→', 'cyan')} Fetching boilerplate releases from ${remoteUrl}`)
  try {
    // --no-tags: git would otherwise auto-follow tags into refs/tags anyway
    runGitCommand(['fetch', '--no-tags', remoteUrl, RELEASE_FETCH_REFSPEC], absolutePath)
    console.log(`  ${colorize('✓', 'green')} Releases fetched into ${RELEASE_REF_PREFIX}`)
  } catch (error) {
    if (required) {
      console.error(
        `  ${colorize('❌', 'red')} Failed to fetch releases from ${remoteUrl}: ${error instanceof Error ? error.message : String(error)}`,
      )
      process.exit(1)
    }
    console.log(
      `  ${colorize('⚠', 'yellow')} Could not fetch from ${remoteUrl} — using locally available releases`,
    )
  }
}

function archiveGitReference(reference: string, destination: string, cwd = projectRoot): void {
  // --output avoids buffering the archive on stdout (execFileSync caps stdout at 1MB by default)
  const tarFile = join(destination, '.reference.tar')
  try {
    execFileSync(
      'git',
      ['archive', '--format=tar', `--output=${tarFile}`, reference, '.boilerstone/'],
      { cwd, env: isolatedGitEnv() },
    )
    execFileSync('tar', ['-xf', tarFile, '-C', destination])
  } finally {
    rmSync(tarFile, { force: true })
  }
}

// Stages the app-code paths declared by the staged intentions ("## Reference
// Paths") from the target tag, so the executor can compare meaning without
// cloning the whole boilerplate. Paths missing at the tag are silently skipped
// (some entries are prose like "or the project's equivalent config").
function extractIntentionReferencePaths(
  intentions: Array<Pick<MigrationIntention, 'content'>>,
  targetTag: string,
  destination: string,
  cwd: string,
): string[] {
  const declaredPaths = [
    ...new Set(intentions.flatMap((intention) => parseReferencePaths(intention.content))),
  ]
  const existingPaths = declaredPaths.filter((path) => {
    try {
      return runGitCommand(['ls-tree', '-r', '--name-only', targetTag, '--', path], cwd) !== ''
    } catch {
      return false
    }
  })

  if (existingPaths.length === 0) {
    return []
  }

  const tarFile = join(destination, '.reference.tar')
  execFileSync(
    'git',
    ['archive', '--format=tar', `--output=${tarFile}`, targetTag, ...existingPaths],
    { cwd, env: isolatedGitEnv() },
  )
  execFileSync('tar', ['-xf', tarFile, '-C', destination])
  rmSync(tarFile, { force: true })
  return existingPaths
}

function gitFileExists(reference: string, filePath: string, cwd = projectRoot): boolean {
  try {
    runGitCommand(['cat-file', '-e', `${reference}:${filePath}`], cwd)
    return true
  } catch {
    return false
  }
}

function listGitMarkdownFiles(reference: string, directory: string, cwd = projectRoot): string[] {
  try {
    const output = runGitCommand(['ls-tree', '-r', '--name-only', reference, '--', directory], cwd)
    return output
      .split('\n')
      .filter((file) => file.endsWith('.md'))
      .sort()
  } catch {
    return []
  }
}

function readGitFile(reference: string, filePath: string, cwd = projectRoot): string {
  return execFileSync('git', ['show', `${reference}:${filePath}`], {
    cwd,
    encoding: 'utf-8',
    env: isolatedGitEnv(),
  })
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
    throw new Error(
      `Branch ${branchName} already exists. Check it out before preparing the upgrade.`,
    )
  }

  runGitCommand(['checkout', '-b', branchName], workDir)
}

function getGitTagNames(cwd = projectRoot): string[] {
  let tags = ''
  try {
    tags = runGitCommand(['tag', '--list', 'v*', '--sort=-v:refname'], cwd)
  } catch {
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
    .filter((entry) => entry.isDirectory() && /^v\d+\.\d+\.\d+$/.test(entry.name))
    .filter((entry) => existsSync(join(intentionsDir, entry.name, 'README.md')))
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

interface IntentionLintIssue {
  file: string
  issue: string
}

function getLocalIntentionMarkdownFiles(): string[] {
  const intentionsDir = join(boilerplateDir, 'migration-intentions')
  return listMarkdownFiles(intentionsDir, true).filter(
    (file) =>
      !file.endsWith('README.md') &&
      !file.endsWith('classification.md') &&
      !file.endsWith('TEMPLATE.md'),
  )
}

interface LocalIntentionEntry {
  release: string
  file: string
  fileName: string
  id: string
  requires: string[]
  domain?: string
  classification: string
  goal: string
}

function extractGoalLine(content: string): string {
  const lines = content.split('\n')
  const goalIndex = lines.findIndex((line) => line.trim() === '## Goal')
  if (goalIndex === -1) {
    return ''
  }
  for (const line of lines.slice(goalIndex + 1)) {
    if (line.startsWith('## ')) {
      break
    }
    if (line.trim()) {
      return line.trim()
    }
  }
  return ''
}

// All producer-side intentions, in execution order: releases ascending, then
// filename-prefix order within each release.
function getLocalReleaseIntentions(): LocalIntentionEntry[] {
  const entries: LocalIntentionEntry[] = []
  const releases = [...getDiskReleaseInfos()].sort((a, b) => compareVersions(a.version, b.version))

  for (const release of releases) {
    const releaseDir = join(boilerplateDir, 'migration-intentions', release.tag)
    const files = listMarkdownFiles(releaseDir, true).filter(
      (file) => !file.endsWith('README.md') && !file.endsWith('classification.md'),
    )
    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      const parsed = parseIntentionMetadataContent(content)
      entries.push({
        release: release.tag,
        file,
        fileName: relative(releaseDir, file),
        id:
          parsed.metadata.id || getFallbackIntentionId(release.version, relative(releaseDir, file)),
        requires: parsed.metadata.requires ?? [],
        domain: parsed.metadata.domain,
        classification: parsed.metadata.classification || 'migration',
        goal: extractGoalLine(content),
      })
    }
  }

  return entries
}

const INTENTIONS_BLOCK_BEGIN =
  '<!-- boilerstone:intentions:begin — generated by `pnpm boilerplate intentions sync`, do not edit -->'
const INTENTIONS_BLOCK_END = '<!-- boilerstone:intentions:end -->'

function renderIntentionsBlock(entries: LocalIntentionEntry[]): string {
  const lines = entries.map((entry) => {
    const badges = [`\`${entry.classification}\``, entry.domain ? `\`${entry.domain}\`` : '']
      .filter(Boolean)
      .join(' · ')
    const requires =
      entry.requires.length > 0
        ? ` — requires ${entry.requires.map((r) => `\`${r}\``).join(', ')}`
        : ''
    return `- [\`${entry.fileName}\`](./${entry.fileName}) — ${badges} — ${entry.goal}${requires}`
  })
  return `${INTENTIONS_BLOCK_BEGIN}\n\n${lines.join('\n')}\n\n${INTENTIONS_BLOCK_END}`
}

// Returns the README content with a fresh generated block, or undefined when
// the markers are missing (the README opts out / predates the convention).
function renderReleaseReadme(
  currentContent: string,
  entries: LocalIntentionEntry[],
): string | undefined {
  const beginIndex = currentContent.indexOf(INTENTIONS_BLOCK_BEGIN)
  const endIndex = currentContent.indexOf(INTENTIONS_BLOCK_END)
  if (beginIndex === -1 || endIndex === -1 || endIndex < beginIndex) {
    return undefined
  }
  return (
    currentContent.slice(0, beginIndex) +
    renderIntentionsBlock(entries) +
    currentContent.slice(endIndex + INTENTIONS_BLOCK_END.length)
  )
}

function getIntentionLintIssues(): IntentionLintIssue[] {
  const issues: IntentionLintIssue[] = []

  for (const file of getLocalIntentionMarkdownFiles()) {
    const content = readFileSync(file, 'utf-8')
    const parsed = parseIntentionMetadataContent(content)
    for (const issue of parsed.issues) {
      issues.push({ file: relative(projectRoot, file), issue })
    }

    const id = parsed.metadata.id
    if (id && !isValidIntentionId(id)) {
      issues.push({ file: relative(projectRoot, file), issue: `invalid id: ${id}` })
    }

    const release = file.match(/migration-intentions\/(v\d+\.\d+\.\d+)\//)?.[1]
    if (id && release && !id.startsWith(`${release}/`)) {
      issues.push({ file: relative(projectRoot, file), issue: `id must start with ${release}/` })
    }

    if (release && !/^\d+-/.test(file.split('/').pop() ?? '')) {
      issues.push({
        file: relative(projectRoot, file),
        issue: 'missing execution-order filename prefix (NN-slug.md)',
      })
    }
  }

  // Dependency graph vs execution order (filename prefixes)
  const entries = getLocalReleaseIntentions()
  for (const orderIssue of getIntentionOrderIssues(
    entries.map((entry) => ({
      id: entry.id,
      file: relative(projectRoot, entry.file),
      requires: entry.requires,
    })),
  )) {
    issues.push(orderIssue)
  }

  // Release README generated blocks must be present and fresh
  const releases = new Set(entries.map((entry) => entry.release))
  for (const release of releases) {
    const readmePath = join(boilerplateDir, 'migration-intentions', release, 'README.md')
    const readmeFile = relative(projectRoot, readmePath)
    const currentContent = readFileSync(readmePath, 'utf-8')
    const freshContent = renderReleaseReadme(
      currentContent,
      entries.filter((entry) => entry.release === release),
    )
    if (freshContent === undefined) {
      issues.push({ file: readmeFile, issue: 'missing boilerstone:intentions markers' })
    } else if (freshContent !== currentContent) {
      issues.push({
        file: readmeFile,
        issue: 'intentions block out of date — run pnpm boilerplate intentions sync',
      })
    }
  }

  return issues
}

function cmdIntentionsSync(): void {
  const entries = getLocalReleaseIntentions()
  const releases = new Set(entries.map((entry) => entry.release))
  let updated = 0

  for (const release of releases) {
    const readmePath = join(boilerplateDir, 'migration-intentions', release, 'README.md')
    const currentContent = readFileSync(readmePath, 'utf-8')
    const freshContent = renderReleaseReadme(
      currentContent,
      entries.filter((entry) => entry.release === release),
    )
    if (freshContent === undefined) {
      console.error(
        `  ${colorize('❌', 'red')} ${relative(projectRoot, readmePath)}: missing boilerstone:intentions markers`,
      )
      process.exit(1)
    }
    if (freshContent !== currentContent) {
      writeFileSync(readmePath, freshContent, 'utf-8')
      updated += 1
      console.log(`  ${colorize('✓', 'green')} Updated ${relative(projectRoot, readmePath)}`)
    }
  }

  if (updated === 0) {
    console.log(`  ${colorize('✓', 'green')} Release READMEs already in sync`)
  }
}

function cmdIntentionsLint(json = false): void {
  const issues = getIntentionLintIssues()
  if (json) {
    console.log(JSON.stringify({ ok: issues.length === 0, issues }, null, 2))
  } else if (issues.length === 0) {
    console.log(`  ${colorize('✓', 'green')} Migration intentions are valid`)
  } else {
    console.error(`  ${colorize('❌', 'red')} Migration intentions have metadata issues:`)
    for (const issue of issues) {
      console.error(`    ${colorize(issue.file, 'bright')}: ${issue.issue}`)
    }
  }

  if (issues.length > 0) {
    process.exit(1)
  }
}

// Release candidates: namespaced refs fetched from the boilerplate remote, plus
// local v* tags that carry producer artifacts (the boilerplate checkout itself).
// A consumer's own app tags never qualify — they have no migration-intentions.
function getReleaseTagNames(cwd = projectRoot): string[] {
  const names = new Set<string>()
  try {
    const refs = runGitCommand(
      ['for-each-ref', '--format=%(refname)', `${RELEASE_REF_PREFIX}v*`],
      cwd,
    )
    for (const refname of refs.split('\n').filter(Boolean)) {
      names.add(refname.slice(RELEASE_REF_PREFIX.length))
    }
  } catch {
    // no namespaced refs fetched yet
  }
  for (const tag of getGitTagNames(cwd)) {
    if (!names.has(tag) && gitFileExists(tag, `.boilerstone/migration-intentions/${tag}`, cwd)) {
      names.add(tag)
    }
  }
  return [...names]
}

function getReleases(cwd = projectRoot): ReleaseInfo[] {
  const releasesByVersion = new Map<string, ReleaseInfo>()

  for (const tag of getReleaseTagNames(cwd)) {
    const ref = releaseRef(tag, cwd)
    const version = tag.replace(/^v/, '')
    const date = runGitCommand(['log', '-1', '--format=%ci', ref], cwd).split(' ')[0]
    // Intentions for a release live in its git tag: a consumer forked at an older
    // version does not have the newer files on disk. Disk is the fallback for
    // releases drafted in the boilerplate repo but not tagged yet.
    const hasMigrations =
      gitFileExists(ref, `.boilerstone/migration-intentions/${tag}/README.md`, cwd) ||
      existsSync(join(boilerplateDir, 'migration-intentions', tag, 'README.md'))
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
    console.log(`  ${colorize('→', 'cyan')} Fetch the boilerplate releases first:`)
    console.log(`    ${colorize(getFetchReleasesCommand(defaultBoilerplateRemote), 'bright')}`)
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

interface ResolveUpgradePathOptions {
  sourceVersion: string
  targetVersion: string
  trackedDomains: string[]
  appliedIntentions: string[]
  skippedIntentions: string[]
  releases?: ReleaseInfo[]
  cwd?: string
}

interface UpgradePathCommandOptions {
  fromVersion: string
  toVersion: string
  projectPath: string
  json?: boolean
  fetch?: boolean
}

interface UpgradePrepareCommandOptions {
  projectPath: string
  toVersion?: string
  fetch?: boolean
  includeIds: string[]
  excludeIds: string[]
  select?: boolean
}

interface UpgradeRecordCommandOptions {
  projectPath: string
  id: string
  status: 'applied' | 'skipped'
  reason?: string
}

interface UpgradeFinishCommandOptions {
  projectPath: string
  targetVersion: string
}

function assertBoilerplateState(
  value: unknown,
  filePath: string,
): asserts value is BoilerplateState {
  const invalid = (reason: string): never => {
    throw new Error(
      `Malformed ${filePath}: ${reason}. Fix it or re-run \`pnpm boilerplate upgrade init\`.`,
    )
  }

  if (typeof value !== 'object' || value === null) {
    invalid('expected a JSON object')
  }

  const state = value as Record<string, unknown>
  if (typeof state.source !== 'object' || state.source === null) {
    invalid('source must be an object')
  }
  const source = state.source as Record<string, unknown>
  if (typeof source.currentVersion !== 'string') {
    invalid('source.currentVersion must be a string')
  }
  if (source.commit !== undefined && typeof source.commit !== 'string') {
    invalid('source.commit must be a string when present')
  }
  if (!Array.isArray(state.trackedDomains)) {
    invalid('trackedDomains must be an array')
  }

  const intentions = state.intentions as Record<string, unknown> | undefined
  if (!intentions || !Array.isArray(intentions.applied) || !Array.isArray(intentions.skipped)) {
    invalid('intentions.applied and intentions.skipped must be arrays')
  }
}

function readBoilerplateJson(projectPath: string): BoilerplateState | null {
  const boilerplateJsonPath = join(projectPath, '.boilerstone', 'boilerplate.json')
  if (!existsSync(boilerplateJsonPath)) {
    return null
  }

  const content = readFileSync(boilerplateJsonPath, 'utf-8')
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch (error) {
    throw new Error(
      `Invalid JSON in ${boilerplateJsonPath}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  assertBoilerplateState(parsed, boilerplateJsonPath)
  return parsed
}

function writeBoilerplateJson(projectPath: string, state: BoilerplateState): void {
  mkdirSync(join(projectPath, '.boilerstone'), { recursive: true })
  const boilerplateJsonPath = join(projectPath, '.boilerstone', 'boilerplate.json')
  writeFileSync(boilerplateJsonPath, `${JSON.stringify(state, null, 2)}\n`, 'utf-8')
}

function isValidIntentionId(id: string): boolean {
  return /^v?\d+\.\d+\.\d+(?:\/[a-z0-9-]+)+$/.test(id)
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function ensureInitializedState(projectPath: string): BoilerplateState {
  const state = readBoilerplateJson(projectPath)
  if (!state) {
    throw new Error(`No boilerplate.json found in ${projectPath}`)
  }
  return state
}

function cmdUpgradeRecord(options: UpgradeRecordCommandOptions): void {
  const absolutePath = options.projectPath ? getProjectPath(options.projectPath) : projectRoot
  if (!isValidIntentionId(options.id)) {
    throw new Error(`Invalid intention id: ${options.id}`)
  }

  const state = ensureInitializedState(absolutePath)
  const alreadyResolved =
    state.intentions.applied.some((intention) => intention.id === options.id) ||
    state.intentions.skipped.some((intention) => intention.id === options.id)
  if (alreadyResolved) {
    throw new Error(`Intention already recorded: ${options.id}`)
  }

  if (options.status === 'applied') {
    state.intentions.applied.push({ id: options.id, appliedAt: getToday() })
  } else {
    const reason = options.reason?.trim()
    if (!reason || reason.length < 10) {
      throw new Error('--reason must be at least 10 characters when recording a skipped intention')
    }
    state.intentions.skipped.push({ id: options.id, reason })
  }

  writeBoilerplateJson(absolutePath, state)
  console.log(`  ${colorize('✓', 'green')} Recorded ${options.status}: ${options.id}`)
}

function cmdUpgradeFinish(options: UpgradeFinishCommandOptions): void {
  const absolutePath = options.projectPath ? getProjectPath(options.projectPath) : projectRoot
  const state = ensureInitializedState(absolutePath)
  state.source.currentVersion = options.targetVersion.replace(/^v/, '')
  writeBoilerplateJson(absolutePath, state)
  console.log(
    `  ${colorize('✓', 'green')} Updated source.currentVersion to ${state.source.currentVersion}`,
  )
}

function detectSourceVersion(
  projectPath: string,
): { version: string; confidence: 'high' | 'medium' } | null {
  const state = readBoilerplateJson(projectPath)
  if (state) {
    return { version: state.source.currentVersion, confidence: 'high' }
  }

  try {
    // Nearest release tag reachable from the project's own HEAD. Works when the
    // project keeps shared history with the boilerplate (and has fetched its tags);
    // otherwise it throws and we fall back to the manual prompt.
    const tag = runGitCommand(['describe', '--tags', '--abbrev=0', '--match', 'v*'], projectPath)
    if (tag) {
      return { version: tag.replace(/^v/, ''), confidence: 'medium' }
    }
  } catch {
    // No matching ancestor tag, or not a readable git worktree
  }

  return null
}

async function cmdBootstrap(projectPath: string): Promise<void> {
  console.log(`\n${colorize('🪨  Onboarding project to the boilerplate upgrade system', 'cyan')}\n`)

  const root = getProjectPath(projectPath)
  const dir = join(root, '.boilerstone')

  if (!existsSync(dir)) {
    console.error(`  ${colorize('❌', 'red')} No .boilerstone/ directory found in ${root}`)
    console.error(
      `  ${colorize('→', 'cyan')} Fetch it first, e.g. ${colorize('pnpm dlx tiged lonestone/lonestone-boilerplate/.boilerstone .boilerstone', 'bright')}`,
    )
    process.exit(1)
  }

  // 1. Wire the root package.json (boilerplate script + tsx runtime).
  const pkgPath = join(root, 'package.json')
  if (!existsSync(pkgPath)) {
    console.error(`  ${colorize('❌', 'red')} No package.json found in ${root}`)
    process.exit(1)
  }
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as PackageJsonShape
  const wiring = ensurePackageJsonWiring(pkg, defaultTsxVersion)
  if (wiring.changes.length > 0) {
    writeFileSync(pkgPath, `${JSON.stringify(wiring.pkg, null, 2)}\n`, 'utf-8')
    for (const change of wiring.changes) {
      console.log(`  ${colorize('✓', 'green')} package.json: ${change}`)
    }
  } else {
    console.log(`  ${colorize('✓', 'green')} package.json already wired`)
  }

  // 2. Ignore the temporary upgrade workspace.
  const gitignorePath = join(root, '.gitignore')
  const currentIgnore = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf-8') : ''
  const nextIgnore = ensureGitignoreLine(currentIgnore, '.boilerstone/upgrade/')
  if (nextIgnore.changed) {
    writeFileSync(gitignorePath, nextIgnore.content, 'utf-8')
    console.log(`  ${colorize('✓', 'green')} .gitignore: ignored .boilerstone/upgrade/`)
  } else {
    console.log(`  ${colorize('✓', 'green')} .gitignore already ignores .boilerstone/upgrade/`)
  }

  // 3. Switch .boilerstone/ to consumer mode (drop producer-only artifacts).
  let removed = 0
  for (const artifact of PRODUCER_ARTIFACTS) {
    const target = join(dir, artifact)
    if (existsSync(target)) {
      rmSync(target, { recursive: true, force: true })
      console.log(`  ${colorize('✓', 'green')} removed producer artifact .boilerstone/${artifact}`)
      removed += 1
    }
  }
  if (removed === 0) {
    console.log(`  ${colorize('✓', 'green')} .boilerstone/ already in consumer mode`)
  }

  // 4. Initialize tracking state (detects/confirms the source version).
  await cmdUpgradeInit(projectPath)

  console.log(`\n${colorize('✅ Bootstrap complete', 'green')}`)
  console.log(`\n${colorize('Next steps:', 'cyan')}`)
  if (process.env.BOILERPLATE_INSTALLER_ONBOARD === '1') {
    console.log(
      `  ${colorize('1.', 'bright')} Check readiness:         ${colorize('pnpm boilerplate upgrade status', 'blue')}`,
    )
    console.log(
      `  ${colorize('2.', 'bright')} Review the onboarding commit ${colorize('(the installer offers to create it)', 'dim')}\n`,
    )
  } else {
    console.log(
      `  ${colorize('1.', 'bright')} Install the CLI runtime: ${colorize('pnpm install', 'blue')}`,
    )
    console.log(
      `  ${colorize('2.', 'bright')} Check readiness:         ${colorize('pnpm boilerplate upgrade status', 'blue')}`,
    )
    console.log(
      `  ${colorize('3.', 'bright')} Commit the integration   ${colorize('(.boilerstone/, package.json, .gitignore)', 'dim')}\n`,
    )
  }
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
  const envVersion = process.env.BOILERPLATE_SOURCE_VERSION?.trim().replace(/^v/, '')

  let version = envVersion || '1.0.0'
  if (envVersion) {
    console.log(
      `  ${colorize('🔍', 'cyan')} Using source version from environment: ${colorize(envVersion, 'bright')}`,
    )
  } else if (detected) {
    console.log(
      `  ${colorize('🔍', 'cyan')} Detected source version: ${colorize(detected.version, 'bright')} (confidence: ${detected.confidence})`,
    )
    version = detected.version
  } else {
    console.log(`  ${colorize('⚠', 'yellow')} Could not detect source version`)
  }

  if (!envVersion) {
    console.log(
      `  ${colorize('ℹ', 'cyan')} Intentions tagged with the source version itself are never replayed.`,
    )
    console.log(
      `  ${colorize('ℹ', 'cyan')} If this project predates the upgrade system or you are unsure, answer ${colorize('0.0.0', 'bright')} so every intention stays applicable.`,
    )
  }
  const sourceVersion = envVersion || (await prompt('Enter source boilerplate version', version))
  const state: BoilerplateState = {
    schemaVersion: 1,
    source: {
      repository: 'lonestone/lonestone-boilerplate',
      remote: getConfiguredBoilerplateRemote(),
      currentVersion: sourceVersion,
      commit: process.env.BOILERPLATE_SOURCE_COMMIT?.trim() || undefined,
    },
    trackedDomains: [
      'tooling',
      'api',
      'frontend',
      'ci',
      'docker-env',
      'monitoring',
      'email',
      'auth',
      'storage',
      'ai',
    ],
    intentions: {
      applied: [],
      skipped: [],
    },
  }

  writeBoilerplateJson(absolutePath, state)
  console.log(`\n  ${colorize('✓', 'green')} Created boilerplate.json`)
  console.log(`  ${colorize('Remote:', 'dim')} ${state.source.remote}`)
  console.log(`  ${colorize('Source version:', 'dim')} ${sourceVersion}`)
}

function formatIntentionListItem(intention: MigrationIntention): string {
  const domain = intention.domain ? ` [${intention.domain}]` : ''
  const metadataIssues =
    intention.metadataIssues.length > 0
      ? colorize(` metadata: ${intention.metadataIssues.join(', ')}`, 'yellow')
      : ''

  return `${colorize('•', 'cyan')} ${colorize(intention.id, 'bright')}${domain}${metadataIssues}`
}

function getMetadataIssueCount(intentions: MigrationIntention[]): number {
  return intentions.filter((intention) => intention.metadataIssues.length > 0).length
}

function formatCountList(counts: Record<string, number>): string {
  const entries = Object.entries(counts).filter(([, count]) => count > 0)
  if (entries.length === 0) {
    return '_none_'
  }

  return entries.map(([name, count]) => `- ${name}: ${count}`).join('\n')
}

function formatIntentionPromptItem(intention: MigrationIntention): string {
  const stopFirst =
    intention.classification === 'breaking-manual'
      ? ' - STOP FIRST: requires human decision before edits'
      : ''
  return `- [ ] ${intention.id} (${intention.classification})${stopFirst}`
}

function formatMetadataWarnings(intentions: MigrationIntention[]): string {
  const intentionsWithIssues = intentions.filter((intention) => intention.metadataIssues.length > 0)
  if (intentionsWithIssues.length === 0) {
    return '_none_'
  }

  return intentionsWithIssues
    .map((intention) => `- ${intention.id}: ${intention.metadataIssues.join(', ')}`)
    .join('\n')
}

function parseCommaSeparatedOption(value: string | undefined): string[] {
  if (!value) {
    return []
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function assertKnownIntentionIds(intentions: MigrationIntention[], ids: string[]): void {
  const knownIds = new Set(intentions.map((intention) => intention.id))
  const unknownIds = ids.filter((id) => !knownIds.has(id))
  if (unknownIds.length > 0) {
    throw new Error(`Unknown intention id(s): ${unknownIds.join(', ')}`)
  }
}

function filterUpgradePathIntentions(
  path: UpgradePath,
  includeIds: string[],
  excludeIds: string[],
): UpgradePath {
  if (includeIds.length > 0 && excludeIds.length > 0) {
    throw new Error('Use either --include or --exclude, not both')
  }

  assertKnownIntentionIds(path.intentions, includeIds)
  assertKnownIntentionIds(path.intentions, excludeIds)

  if (includeIds.length > 0) {
    const selectedIds = new Set(includeIds)
    return {
      ...path,
      intentions: path.intentions.filter((intention) => selectedIds.has(intention.id)),
    }
  }

  if (excludeIds.length > 0) {
    const excludedIds = new Set(excludeIds)
    return {
      ...path,
      intentions: path.intentions.filter((intention) => !excludedIds.has(intention.id)),
    }
  }

  return path
}

function parseSelectionIndexes(value: string, max: number): number[] {
  return value
    .split(',')
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((index) => Number.isInteger(index) && index >= 1 && index <= max)
}

async function selectUpgradePathIntentions(path: UpgradePath): Promise<UpgradePath> {
  if (path.intentions.length === 0) {
    return path
  }

  console.log(`\n  ${colorize('Selectable intentions:', 'cyan')}`)
  path.intentions.forEach((intention, index) => {
    const domain = intention.domain ? ` [${intention.domain}]` : ''
    console.log(`    ${colorize(`${index + 1}.`, 'bright')} ${intention.id}${domain}`)
  })

  const answer = await prompt(
    'Select intentions by number, comma-separated; leave blank for all',
    '',
  )
  if (!answer) {
    return path
  }

  const selectedIndexes = new Set(parseSelectionIndexes(answer, path.intentions.length))
  if (selectedIndexes.size === 0) {
    throw new Error('No valid intention selection')
  }

  return {
    ...path,
    intentions: path.intentions.filter((_, index) => selectedIndexes.has(index + 1)),
  }
}

function getIntentionFiles(releases: ReleaseInfo[], cwd = projectRoot): IntentionFileInput[] {
  return releases.flatMap((release) => {
    // Git tag first: consumers forked before this release only have it in git
    const releaseDirInGit = `.boilerstone/migration-intentions/v${release.version}`
    const ref = releaseRef(release.tag, cwd)
    if (gitFileExists(ref, `${releaseDirInGit}/README.md`, cwd)) {
      return listGitMarkdownFiles(ref, releaseDirInGit, cwd)
        .filter((file) => !file.endsWith('README.md') && !file.endsWith('classification.md'))
        .map((file) => ({
          releaseVersion: release.version,
          file: `${release.tag}:${file}`,
          relativePath: file.slice(releaseDirInGit.length + 1),
          content: readGitFile(ref, file, cwd),
        }))
    }

    // Disk fallback: release drafted in the boilerplate repo but not tagged yet
    const releaseDir = join(boilerplateDir, 'migration-intentions', `v${release.version}`)
    const releaseReadme = join(releaseDir, 'README.md')
    if (!existsSync(releaseReadme)) {
      return []
    }

    return listMarkdownFiles(releaseDir, true)
      .filter((file) => !file.endsWith('README.md') && !file.endsWith('classification.md'))
      .map((file) => ({
        releaseVersion: release.version,
        file,
        relativePath: relative(releaseDir, file),
        content: readFileSync(file, 'utf-8'),
      }))
  })
}

function resolveUpgradePath(options: ResolveUpgradePathOptions): UpgradePath {
  const releases = options.releases ?? getReleases(options.cwd)
  return computeUpgradePath({
    sourceVersion: options.sourceVersion,
    targetVersion: options.targetVersion,
    trackedDomains: options.trackedDomains,
    appliedIntentions: options.appliedIntentions,
    skippedIntentions: options.skippedIntentions,
    releases,
    intentionFiles: getIntentionFiles(releases, options.cwd),
  })
}

function cmdUpgradePath(options: UpgradePathCommandOptions): void {
  const absolutePath = options.projectPath ? getProjectPath(options.projectPath) : projectRoot
  const state = readBoilerplateJson(absolutePath)

  let sourceVersion = options.fromVersion
  let trackedDomains: string[] = []
  let appliedIntentions: string[] = []
  let skippedIntentions: string[] = []

  if (state) {
    sourceVersion = options.fromVersion || state.source.currentVersion
    trackedDomains = state.trackedDomains
    appliedIntentions = state.intentions.applied.map((i) => i.id)
    skippedIntentions = state.intentions.skipped.map((i) => i.id)
  }

  if (!sourceVersion) {
    console.error(`  ${colorize('❌', 'red')} No source version specified or detected`)
    console.error(
      `  ${colorize('→', 'cyan')} Run ${colorize(`boilerplate upgrade init --project ${options.projectPath}`, 'bright')} or pass ${colorize('--from <version>', 'bright')}`,
    )
    process.exit(1)
  }

  if (options.fetch) {
    fetchBoilerplateReleases(absolutePath, state, { required: true })
  }

  const releases = getReleases(absolutePath)
  if (releases.length === 0) {
    printMissingReleaseTags(state, absolutePath)
    process.exit(1)
  }

  const targetVersion = resolveTargetVersion(options.toVersion, releases)
  const path = resolveUpgradePath({
    sourceVersion,
    targetVersion,
    trackedDomains,
    appliedIntentions,
    skippedIntentions,
    releases,
    cwd: absolutePath,
  })
  const branchName = getUpgradeBranchName(path.sourceVersion, path.targetVersion)

  if (options.json) {
    console.log(JSON.stringify({ ...path, branchName }, null, 2))
    return
  }

  console.log(`\n${colorize('🛤️  Upgrade Path Resolution', 'cyan')}\n`)

  const migrationIntentions = path.intentions.filter(
    (intention) => intention.classification === 'migration',
  )
  const breakingManualIntentions = path.intentions.filter(
    (intention) => intention.classification === 'breaking-manual',
  )
  const metadataIssueCount = getMetadataIssueCount(path.intentions)

  console.log(
    `  ${colorize('Release range:', 'dim')} ${colorize(`v${path.sourceVersion} → v${path.targetVersion}`, 'bright')}`,
  )
  console.log(`  ${colorize('Target branch:', 'dim')} ${colorize(branchName, 'bright')}`)
  console.log(`  ${colorize('Releases:', 'dim')} ${path.releases.length}`)
  console.log(`  ${colorize('Already applied/skipped:', 'dim')} ${path.alreadyResolvedCount}`)
  console.log(`  ${colorize('Migration intentions:', 'dim')} ${migrationIntentions.length}`)
  console.log(
    `  ${colorize('Breaking/manual intentions:', 'dim')} ${breakingManualIntentions.length}`,
  )
  console.log(`  ${colorize('Metadata warnings:', 'dim')} ${metadataIssueCount}`)

  console.log(`\n  ${colorize('Counts by classification (whole range):', 'cyan')}\n`)
  console.log(
    formatCountList(path.classificationCounts)
      .split('\n')
      .map((line) => `    ${line}`)
      .join('\n'),
  )

  console.log(`\n  ${colorize('Skipped by domain:', 'cyan')}\n`)
  console.log(
    formatCountList(path.skippedByDomain)
      .split('\n')
      .map((line) => `    ${line}`)
      .join('\n'),
  )

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

  if (path.intentions.length === 0 && path.alreadyResolvedCount === 0) {
    console.log(
      `\n  ${colorize('⚠', 'yellow')} No applicable intentions. Intentions tagged v${path.sourceVersion} are never replayed — if this project predates them, lower ${colorize('source.currentVersion', 'bright')} in .boilerstone/boilerplate.json (e.g. 0.0.0).`,
    )
  }

  console.log()
}

function cmdUpgradeStatus(projectPath: string, json = false): void {
  const absolutePath = projectPath ? getProjectPath(projectPath) : projectRoot
  const state = readBoilerplateJson(absolutePath)
  const report = createHealthReport(absolutePath)

  if (json) {
    console.log(
      JSON.stringify(
        {
          initialized: Boolean(state),
          ...state,
          checks: report.checks,
          summary: report.summary,
        },
        null,
        2,
      ),
    )
    if (report.summary.failed > 0) {
      process.exit(1)
    }
    return
  }

  console.log(`\n${colorize('📊 Boilerplate Upgrade Status', 'cyan')}\n`)

  if (!state) {
    console.log(`  ${colorize('⚠', 'yellow')} No boilerplate.json found`)
    console.log(
      `  ${colorize('→', 'cyan')} Run ${colorize('boilerplate upgrade init', 'bright')} first`,
    )
  } else {
    console.log(`  ${colorize('Repository:', 'dim')} ${state.source.repository}`)
    console.log(`  ${colorize('Remote:', 'dim')} ${getBoilerplateRemote(state)}`)
    console.log(
      `  ${colorize('Current version:', 'dim')} ${colorize(state.source.currentVersion, 'bright')}`,
    )
    if (state.source.commit) {
      console.log(`  ${colorize('Source commit:', 'dim')} ${state.source.commit}`)
    }
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
  }

  console.log(`\n  ${colorize('Readiness:', 'bright')}`)
  for (const check of report.checks) {
    console.log(
      `  ${formatHealthIcon(check.status)} ${colorize(check.name, 'bright')}: ${check.message}`,
    )
    if (check.suggestion) {
      for (const command of check.suggestion.split('\n')) {
        console.log(`    ${colorize('→', 'cyan')} ${colorize(command, 'dim')}`)
      }
    }
  }

  console.log(
    `\n  ${colorize('Summary:', 'bright')} ${report.summary.passed} passed, ${report.summary.warnings} warning(s), ${report.summary.failed} failed\n`,
  )

  if (report.summary.failed > 0) {
    process.exit(1)
  }
}

interface HealthCheck {
  name: string
  status: 'passed' | 'warning' | 'failed'
  message: string
  suggestion?: string
}

interface HealthReport {
  projectPath: string
  initialized: boolean
  checks: HealthCheck[]
  summary: {
    passed: number
    warnings: number
    failed: number
  }
}

function createHealthReport(projectPath: string): HealthReport {
  const checks: HealthCheck[] = []
  const state = readBoilerplateJson(projectPath)

  checks.push(
    state
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
        },
  )

  try {
    const dirtyOutput = runGitCommand(['status', '--porcelain'], projectPath)
    checks.push(
      dirtyOutput
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
          },
    )
  } catch {
    checks.push({
      name: 'git worktree',
      status: 'failed',
      message: 'Project path is not a readable git worktree',
    })
  }

  const remoteUrl = getBoilerplateRemote(state)
  const releaseTagNames = getReleaseTagNames(projectPath)
  checks.push(
    releaseTagNames.length > 0
      ? {
          name: 'releases',
          status: 'passed',
          message: `${releaseTagNames.length} boilerplate release(s) available locally`,
        }
      : {
          name: 'releases',
          status: 'failed',
          message: 'No local boilerplate releases found',
          suggestion: getFetchReleasesCommand(remoteUrl),
        },
  )

  // 0.0.0 means "predates the first release" — there is legitimately no such tag.
  if (state && releaseTagNames.length > 0 && state.source.currentVersion !== '0.0.0') {
    const sourceTag = `v${state.source.currentVersion.replace(/^v/, '')}`
    checks.push(
      releaseTagNames.includes(sourceTag)
        ? {
            name: 'current version release',
            status: 'passed',
            message: `${sourceTag} is available locally`,
          }
        : {
            name: 'current version release',
            status: 'warning',
            message: `${sourceTag} is not available locally`,
            suggestion: getFetchReleasesCommand(remoteUrl),
          },
    )
  }

  const producerArtifacts = PRODUCER_ARTIFACTS.map((artifact) => `.boilerstone/${artifact}`).filter(
    (file) => existsSync(join(projectPath, file)),
  )

  checks.push(
    producerArtifacts.length === 0
      ? {
          name: 'consumer cleanup',
          status: 'passed',
          message: 'No producer-only upgrade artifacts found',
        }
      : {
          name: 'consumer cleanup',
          status: 'warning',
          message: `Producer-only artifacts are present: ${producerArtifacts.join(', ')}`,
          suggestion:
            'This is expected in the boilerplate repository; generated projects should re-run pnpm rock or remove producer artifacts manually',
        },
  )

  return {
    projectPath,
    initialized: Boolean(state),
    checks,
    summary: {
      passed: checks.filter((check) => check.status === 'passed').length,
      warnings: checks.filter((check) => check.status === 'warning').length,
      failed: checks.filter((check) => check.status === 'failed').length,
    },
  }
}

function formatHealthIcon(status: HealthCheck['status']): string {
  if (status === 'passed') {
    return colorize('✓', 'green')
  }

  if (status === 'warning') {
    return colorize('⚠', 'yellow')
  }

  return colorize('✗', 'red')
}

async function cmdUpgradePrepare(options: UpgradePrepareCommandOptions): Promise<void> {
  console.log(`\n${colorize('📦 Preparing Upgrade Context', 'cyan')}\n`)

  const absolutePath = options.projectPath ? getProjectPath(options.projectPath) : projectRoot
  const state = readBoilerplateJson(absolutePath)

  if (!state) {
    console.error(`  ${colorize('❌', 'red')} No boilerplate.json found.`)
    console.error(
      `  ${colorize('→', 'cyan')} Run ${colorize(`boilerplate upgrade init --project ${options.projectPath}`, 'bright')} first.`,
    )
    process.exit(1)
  }

  const dirtyOutput = runGitCommand(['status', '--porcelain'], absolutePath)
  if (dirtyOutput) {
    console.error(`  ${colorize('❌', 'red')} Git worktree is dirty. Clean before upgrading.`)
    console.error(
      `  ${colorize('→', 'cyan')} Inspect changes with ${colorize(`git -C ${absolutePath} status --short`, 'bright')}`,
    )
    process.exit(1)
  }

  const requestedVersion = options.toVersion || 'latest'

  if (options.fetch) {
    fetchBoilerplateReleases(absolutePath, state, { required: true })
  }

  let releases = getReleases(absolutePath)
  // Fetch automatically when it is needed: no releases yet, or `latest` should
  // reflect the remote. Best-effort — offline, local releases still work.
  if (!options.fetch && (releases.length === 0 || requestedVersion === 'latest')) {
    fetchBoilerplateReleases(absolutePath, state, { required: false })
    releases = getReleases(absolutePath)
  }
  if (releases.length === 0) {
    printMissingReleaseTags(state, absolutePath)
    process.exit(1)
  }

  const targetVersion = resolveTargetVersion(requestedVersion, releases)

  const resolvedPath = resolveUpgradePath({
    sourceVersion: state.source.currentVersion,
    targetVersion,
    trackedDomains: state.trackedDomains,
    appliedIntentions: state.intentions.applied.map((i) => i.id),
    skippedIntentions: state.intentions.skipped.map((i) => i.id),
    releases,
    cwd: absolutePath,
  })
  if (resolvedPath.intentions.length === 0) {
    console.error(
      `  ${colorize('⚠', 'yellow')} No intentions apply between v${resolvedPath.sourceVersion} and v${resolvedPath.targetVersion} — nothing to prepare.`,
    )
    if (resolvedPath.alreadyResolvedCount > 0) {
      console.error(
        `  ${colorize('→', 'cyan')} All ${resolvedPath.alreadyResolvedCount} intention(s) in range are already applied or skipped; run ${colorize(`boilerplate upgrade finish --to ${resolvedPath.targetVersion}`, 'bright')} to record the version bump.`,
      )
    } else {
      console.error(
        `  ${colorize('→', 'cyan')} Intentions tagged v${resolvedPath.sourceVersion} are never replayed. If this project actually predates them, lower ${colorize('source.currentVersion', 'bright')} in .boilerstone/boilerplate.json (e.g. 0.0.0) and re-run.`,
      )
      console.error(
        `  ${colorize('→', 'cyan')} If the source version is correct and this upgrade is genuinely empty, run ${colorize(`boilerplate upgrade finish --to ${resolvedPath.targetVersion}`, 'bright')}.`,
      )
    }
    process.exit(1)
  }

  const filteredPath = filterUpgradePathIntentions(
    resolvedPath,
    options.includeIds,
    options.excludeIds,
  )
  // Interactive selection is the default on a terminal; explicit --include/
  // --exclude (agents, scripts) or no TTY skip the prompt.
  const interactiveSelect =
    options.select ??
    (process.stdin.isTTY === true &&
      options.includeIds.length === 0 &&
      options.excludeIds.length === 0)
  const upgradePath = interactiveSelect
    ? await selectUpgradePathIntentions(filteredPath)
    : filteredPath

  const stagedIds = new Set(upgradePath.intentions.map((intention) => intention.id))
  const resolvedIds = new Set([
    ...state.intentions.applied.map((intention) => intention.id),
    ...state.intentions.skipped.map((intention) => intention.id),
  ])
  const missingDependencies: Array<{ id: string; requires: string }> = []
  for (const intention of upgradePath.intentions) {
    for (const requiredId of intention.requires) {
      if (!stagedIds.has(requiredId) && !resolvedIds.has(requiredId)) {
        missingDependencies.push({ id: intention.id, requires: requiredId })
      }
    }
  }
  if (missingDependencies.length > 0) {
    for (const { id, requires } of missingDependencies) {
      console.error(
        `  ${colorize('❌', 'red')} ${id} requires ${requires} — include it in the selection or resolve it first.`,
      )
    }
    process.exit(1)
  }

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

  // Extract reference files from git tags. Source and target are independent:
  // a project onboarded at 0.0.0 has no source tag, but the target reference
  // (and its staged intention paths) must still be extracted.
  let stagedReferencePaths: string[] = []
  const sourceRef = releaseRef(upgradePath.sourceTag, absolutePath)
  const targetRef = releaseRef(upgradePath.targetTag, absolutePath)
  try {
    archiveGitReference(sourceRef, join(upgradeDir, 'reference', 'source'), absolutePath)
  } catch {
    writeFileSync(
      join(upgradeDir, 'reference', 'source', 'NO-SOURCE-REFERENCE.md'),
      `Release ${upgradePath.sourceTag} does not exist locally — the project predates the first tracked release. Compare against reference/target/ only.\n`,
      'utf-8',
    )
    console.log(
      `  ${colorize('⚠', 'yellow')} No source reference for ${upgradePath.sourceTag} (release not found) — comparing against the target only`,
    )
  }
  try {
    archiveGitReference(targetRef, join(upgradeDir, 'reference', 'target'), absolutePath)
    stagedReferencePaths = extractIntentionReferencePaths(
      upgradePath.intentions,
      targetRef,
      join(upgradeDir, 'reference', 'target'),
      absolutePath,
    )
    if (stagedReferencePaths.length > 0) {
      console.log(
        `  ${colorize('✓', 'green')} Staged ${stagedReferencePaths.length} app reference path(s) from ${upgradePath.targetTag}`,
      )
    }
  } catch (error) {
    console.log(
      `  ${colorize('⚠', 'yellow')} Could not extract the target reference from ${upgradePath.targetTag}: ${error instanceof Error ? error.message : String(error)}`,
    )
    console.log(
      `  ${colorize('→', 'cyan')} That git reference must exist locally. Fetch it with ${colorize('git fetch <boilerplate-remote> --tags', 'bright')}`,
    )
  }

  const sessionPrompt = generateSessionPrompt(upgradePath, state, stagedReferencePaths, targetRef)
  writeFileSync(join(upgradeDir, 'upgrade-session.md'), sessionPrompt, 'utf-8')

  console.log(`  ${colorize('✓', 'green')} Created .boilerstone/upgrade/ workspace`)
  console.log(`  ${colorize('✓', 'green')} Generated upgrade-session.md`)
  console.log(
    `  ${colorize('→', 'cyan')} ${upgradePath.intentions.length}/${resolvedPath.intentions.length} intentions ready for execution`,
  )
  console.log()
}

function generateSessionPrompt(
  path: UpgradePath,
  state: BoilerplateState,
  stagedReferencePaths: string[] = [],
  targetArchiveRef = `v${path.targetVersion}`,
): string {
  const targetTag = `v${path.targetVersion}`
  const remoteUrl = getBoilerplateRemote(state)
  const stagedReferenceLines =
    stagedReferencePaths.length > 0
      ? stagedReferencePaths.map((referencePath) => `  - \`${referencePath}\``).join('\n')
      : '  - _none staged (release tags were not available locally)_'

  return `# Upgrade Session: v${path.sourceVersion} → v${path.targetVersion}

## Instructions

You are the executor — a developer or an AI agent — applying boilerplate upgrade intentions to this project.

### Rules

1. Work **one intention at a time**
2. Read each intention file before starting
3. Run applicability checks from the intention
4. **Stop** if a "Do not apply when" condition matches
5. For \`breaking-manual\` intentions, **stop before editing files** and write a blocked report describing the required human decision
6. For every file under an intention's Reference Paths, run \`diff <file> .boilerstone/upgrade/reference/target/<file>\` **before** editing — never write these files from memory
7. No project-specific delta in the diff → **copy the staged reference file verbatim**; project deltas → keep them and apply only the reference-side hunks
8. Everywhere else apply the **smallest safe change** and **preserve** all project-specific behavior
9. Run validation after each intention
10. After successful validation, record the outcome with \`pnpm boilerplate upgrade record --id <id> --applied\` or \`--skipped --reason "..."\`
11. **Stop** on unsafe ambiguity and write a blocked report
12. After the last intention is resolved, run \`pnpm boilerplate upgrade finish --to ${path.targetVersion}\`

### Git Policy

- Commit after each resolved intention for risky upgrades; small supervised batches may commit multiple recorded intentions together after validation
- Never rewrite divergent files wholesale
- Never apply cosmetic alignment unless required
- Do not mark an intention as applied before validation passes
- If not applicable, record as skipped with a reason
- Do not update \`source.currentVersion\` before every intention is applied or skipped

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
- App-code reference paths staged at ${targetTag} under \`reference/target/\`:
${stagedReferenceLines}

Need a reference file that is not staged? Extract it from the target tag:

\`\`\`bash
git archive ${targetArchiveRef} -- <path> | tar -x -C .boilerstone/upgrade/reference/target/
# or clone the full boilerplate at the target version (disposable, gitignored):
git clone --depth 1 --branch ${targetTag} ${remoteUrl} .boilerstone/upgrade/reference/full
\`\`\`

Begin with the first intention.
`
}

function printUsage(): void {
  console.log(`
${colorize('🪨  Boilerplate CLI', 'bright')}

${colorize('Usage:', 'cyan')}
  boilerplate <command> [options]

${colorize('Commands:', 'cyan')}

  ${colorize('bootstrap', 'bright')}                  Onboard an existing project (wire CLI + init tracking)
  ${colorize('intentions lint', 'bright')}            Validate published migration intention metadata
  ${colorize('intentions sync', 'bright')}            Regenerate the release README intentions blocks
  ${colorize('versions list', 'bright')}              List available boilerplate versions
  ${colorize('upgrade', 'bright')}                    Stage the next upgrade (latest, auto-fetch, interactive selection)
  ${colorize('upgrade init', 'bright')}               Initialize boilerplate tracking for a project
  ${colorize('upgrade path', 'bright')}               Show upgrade path to target version
  ${colorize('upgrade prepare', 'bright')}            Same as ${colorize('upgrade', 'dim')}, with explicit flags
  ${colorize('upgrade record', 'bright')}             Record an applied/skipped intention in boilerplate.json
  ${colorize('upgrade finish', 'bright')}             Set source.currentVersion after all intentions are resolved
  ${colorize('upgrade status', 'bright')}             Show tracking state and upgrade readiness
${colorize('Options:', 'cyan')}

  ${colorize('--project <path>', 'bright')}           Consumer project to operate on (default: this repository)
  ${colorize('--to <version|latest>', 'bright')}      Target version (default: ${colorize('latest', 'dim')})
  ${colorize('--fetch', 'bright')}                    Force-refresh the boilerplate releases (automatic when needed)
  ${colorize('--select', 'bright')}                   Force interactive intention selection (default on a terminal)
  ${colorize('--include <ids>', 'bright')}            Comma-separated intention ids to stage during ${colorize('upgrade prepare', 'dim')}
  ${colorize('--exclude <ids>', 'bright')}            Comma-separated intention ids to skip from the prepared workspace
  ${colorize('--id <id>', 'bright')}                  Intention id for ${colorize('upgrade record', 'dim')}
  ${colorize('--applied', 'bright')}                  Record an intention as applied
  ${colorize('--skipped', 'bright')}                  Record an intention as skipped (requires ${colorize('--reason', 'dim')})
  ${colorize('--reason <text>', 'bright')}            Skip reason for ${colorize('upgrade record --skipped', 'dim')}
  ${colorize('--json', 'bright')}                     Machine-readable output for ${colorize('upgrade status', 'dim')} and ${colorize('upgrade path', 'dim')}

${colorize('Examples:', 'cyan')}

  ${colorize('boilerplate bootstrap', 'dim')}
  ${colorize('boilerplate intentions lint', 'dim')}
  ${colorize('boilerplate intentions sync', 'dim')}
  ${colorize('boilerplate versions list', 'dim')}
  ${colorize('boilerplate upgrade init --project ./my-project', 'dim')}
  ${colorize('boilerplate upgrade', 'dim')}
  ${colorize('boilerplate upgrade --to 1.5.0', 'dim')}
  ${colorize('boilerplate upgrade path --from 1.0.0 --to 1.5.0', 'dim')}
  ${colorize('boilerplate upgrade prepare --to 1.5.0 --exclude v1.5.0/optional-ai', 'dim')}
  ${colorize('boilerplate upgrade record --id v1.5.0/example --applied', 'dim')}
  ${colorize('boilerplate upgrade finish --to 1.5.0', 'dim')}
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
      } else {
        printUsage()
      }
    } else if (command === 'intentions') {
      const json = args.includes('--json')
      if (subcommand === 'lint') {
        cmdIntentionsLint(json)
      } else if (subcommand === 'sync') {
        cmdIntentionsSync()
      } else {
        printUsage()
      }
    } else if (command === 'bootstrap') {
      const project = readOptionValue(args, '--project') || '.'
      await cmdBootstrap(project)
    } else if (command === 'upgrade') {
      // Accept both `1.0.0` and `v1.0.0` — tags carry the v, versions don't.
      const from = readOptionValue(args, '--from')?.replace(/^v(?=\d)/, '')
      const to = readOptionValue(args, '--to')?.replace(/^v(?=\d)/, '')
      const project = readOptionValue(args, '--project') || '.'
      const json = args.includes('--json')
      const fetch = args.includes('--fetch')
      const includeIds = parseCommaSeparatedOption(readOptionValue(args, '--include'))
      const excludeIds = parseCommaSeparatedOption(readOptionValue(args, '--exclude'))
      const select = args.includes('--select')

      if (subcommand === 'init') {
        await cmdUpgradeInit(project)
      } else if (subcommand === 'path') {
        if (!to) {
          console.error(`  ${colorize('❌', 'red')} --to is required`)
          process.exit(1)
        }
        cmdUpgradePath({
          fromVersion: from || '',
          toVersion: to,
          projectPath: project,
          json,
          fetch,
        })
      } else if (subcommand === 'prepare' || !subcommand || subcommand.startsWith('--')) {
        // `pnpm boilerplate upgrade` is the everyday command: prepare with all
        // defaults (latest, fetch when needed, interactive selection on a TTY).
        await cmdUpgradePrepare({
          projectPath: project,
          toVersion: to,
          fetch,
          includeIds,
          excludeIds,
          select,
        })
      } else if (subcommand === 'record') {
        const id = readOptionValue(args, '--id')
        const reason = readOptionValue(args, '--reason')
        if (!id) {
          console.error(`  ${colorize('❌', 'red')} --id is required`)
          process.exit(1)
        }
        if (args.includes('--applied') === args.includes('--skipped')) {
          console.error(`  ${colorize('❌', 'red')} Pass exactly one of --applied or --skipped`)
          process.exit(1)
        }
        cmdUpgradeRecord({
          projectPath: project,
          id,
          status: args.includes('--applied') ? 'applied' : 'skipped',
          reason,
        })
      } else if (subcommand === 'finish') {
        if (!to) {
          console.error(`  ${colorize('❌', 'red')} --to is required`)
          process.exit(1)
        }
        cmdUpgradeFinish({ projectPath: project, targetVersion: to })
      } else if (subcommand === 'status') {
        cmdUpgradeStatus(project, json)
      } else {
        printUsage()
      }
    } else {
      printUsage()
    }
  } catch (error) {
    console.error(
      `\n${colorize('❌ Error:', 'red')} ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exit(1)
  }
}

// Run only when invoked as a script, so tests can import the helpers below
const isDirectExecution = process.argv[1] ? resolve(process.argv[1]) === __filename : false
if (isDirectExecution) {
  main()
}

export { archiveGitReference, extractIntentionReferencePaths }
