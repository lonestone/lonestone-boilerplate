import type {
  IntentionFileInput,
  MigrationIntention,
  PackageJsonShape,
  ReferencePathDeclaration,
  ReleaseInfo,
  UpgradePath,
} from './boilerplate-core'
import type { TrackingState } from './tracking-state'
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import {
  compareVersions,
  computeUpgradePath,
  ensureGitignoreLine,
  ensurePackageJsonWiring,
  ensureConsumerBoilerstonePackageJson,
  getFallbackIntentionId,
  getIntentionOrderIssues,
  getUpgradeBranchName,
  isUnreleasedIntentionPath,
  parseIntentionMetadataContent,
  parseReferencePathDeclarations,
  parseReferencePaths,
  PRODUCER_ARTIFACTS,
  promoteUnreleasedIntentions,
  readOptionValue,
  resolveTargetVersion,
} from './boilerplate-core'
import { colorize, isolatedGitEnv } from './utils'
import { trackingState } from './tracking-state'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..', '..')
const boilerplateDir = join(projectRoot, '.boilerstone')
const defaultBoilerplateRemote = 'https://github.com/lonestone/lonestone-boilerplate.git'
// Pinned to match the boilerplate's own tsx version; used when wiring a consumer's package.json.
const defaultTsxVersion = '^4.23.5'

async function prompt(message: string, initial: string): Promise<string> {
  // Without a terminal the question would never resolve and the process would
  // silently exit with the work half-done — take the default instead.
  if (process.stdin.isTTY !== true) {
    console.log(`  ${colorize('ℹ', 'cyan')} ${message}: ${initial || '(none)'} (non-interactive)`)
    return initial
  }
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

function normalizeSemanticVersion(version: string, label: 'source' | 'target'): string {
  if (!/^v?\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Invalid ${label} version: ${version}`)
  }
  return version.replace(/^v/, '')
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

function getBoilerplateRemote(state: TrackingState | null): string {
  return state?.source.remote || getConfiguredBoilerplateRemote()
}

function quotePosixShellArgument(value: string): string {
  if (/[\u0000-\u001f\u007f]/.test(value) || value.includes('```')) {
    throw new Error('Cannot render unsafe shell argument containing control characters or ```')
  }
  return `'${value.replaceAll("'", `'"'"'`)}'`
}

// Boilerplate releases are fetched into a dedicated ref namespace instead of
// refs/tags: consumer projects version their own app with their own v* tags,
// and the two must never collide (or worse, overwrite each other).
const RELEASE_REF_PREFIX = 'refs/boilerstone/'
const RELEASE_FETCH_REFSPEC = '+refs/tags/v*:refs/boilerstone/v*'

function getFetchReleasesCommand(remoteUrl: string): string {
  return `git fetch --no-tags ${quotePosixShellArgument(remoteUrl)} "${RELEASE_FETCH_REFSPEC}"`
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

interface ResolvedGitReference {
  ref: string
  cwd: string
  label: string
  isDraft: boolean
  provenance: 'consumer-ref' | 'producer-ref' | 'producer-draft'
}

function hasGitReference(reference: string, cwd: string): boolean {
  try {
    runGitCommand(['rev-parse', '--verify', '--quiet', reference], cwd)
    return true
  } catch {
    return false
  }
}

function resolvePublishedReleaseRef(release: ReleaseInfo, cwd: string): string | null {
  const namespacedRef = `${RELEASE_REF_PREFIX}${release.tag}`
  if (hasGitReference(namespacedRef, cwd)) {
    return namespacedRef
  }

  if (
    hasGitReference(release.tag, cwd) &&
    gitFileExists(release.tag, `.boilerstone/migration-intentions/${release.tag}/README.md`, cwd)
  ) {
    return release.tag
  }

  return null
}

function resolveTargetReference(
  release: ReleaseInfo,
  consumerPath: string,
  producerPath = projectRoot,
): ResolvedGitReference {
  const consumerRef = resolvePublishedReleaseRef(release, consumerPath)
  if (consumerRef) {
    return {
      ref: consumerRef,
      cwd: consumerPath,
      label: consumerRef,
      isDraft: false,
      provenance: 'consumer-ref',
    }
  }

  const producerRef = resolvePublishedReleaseRef(release, producerPath)
  if (producerRef) {
    return {
      ref: producerRef,
      cwd: producerPath,
      label: producerRef,
      isDraft: false,
      provenance: 'producer-ref',
    }
  }

  if (release.date === 'local-draft' && hasGitReference('HEAD', producerPath)) {
    const releaseReadme = `.boilerstone/migration-intentions/${release.tag}/README.md`
    if (!gitFileExists('HEAD', releaseReadme, producerPath)) {
      throw new Error(`Draft release ${release.tag} must exist in producer HEAD before preparation`)
    }
    // Dirty `.boilerstone/` is enforced in prepareUpgrade, not here: `upgrade path`
    // is a read-only query and must not depend on the producer worktree being clean.
    return {
      ref: 'HEAD',
      cwd: producerPath,
      label: `HEAD (producer draft for ${release.tag})`,
      isDraft: true,
      provenance: 'producer-draft',
    }
  }

  throw new Error(`Target ref ${release.tag} is not available in the consumer or producer checkout`)
}

// Fetch the boilerplate release tags straight from the remote URL, without adding
// a persistent git remote, into the refs/boilerstone/ namespace so they can never
// collide with the consumer's own version tags. The `+` in the refspec follows a
// moved release tag (pre-release retags). With `required: false` a failure
// (offline, bad URL) degrades to the locally available releases.
function fetchBoilerplateReleases(
  absolutePath: string,
  state: TrackingState | null,
  { required, report = true }: { required: boolean; report?: boolean },
): string | undefined {
  const remoteUrl = getBoilerplateRemote(state)
  if (report) {
    console.log(`  ${colorize('→', 'cyan')} Fetching boilerplate releases from ${remoteUrl}`)
  }
  try {
    // --no-tags: git would otherwise auto-follow tags into refs/tags anyway
    runGitCommand(['fetch', '--no-tags', remoteUrl, RELEASE_FETCH_REFSPEC], absolutePath)
    if (report) {
      console.log(`  ${colorize('✓', 'green')} Releases fetched into ${RELEASE_REF_PREFIX}`)
    }
    return undefined
  } catch (error) {
    const message = `Failed to fetch releases from ${remoteUrl}: ${error instanceof Error ? error.message : String(error)}`
    if (required) {
      throw new Error(message)
    }
    if (report) {
      console.log(
        `  ${colorize('⚠', 'yellow')} Could not fetch from ${remoteUrl} — using locally available releases`,
      )
    }
    return `${message} — using locally available releases`
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

function getReferencePathDeclarations(
  intentions: Array<Pick<MigrationIntention, 'content'>>,
): ReferencePathDeclaration[] {
  const declarationsByPath = new Map<string, ReferencePathDeclaration>()

  for (const intention of intentions) {
    for (const declaration of parseReferencePathDeclarations(intention.content).references) {
      const current = declarationsByPath.get(declaration.path)
      declarationsByPath.set(declaration.path, {
        path: declaration.path,
        mode: current?.mode === 'adapt' || declaration.mode === 'adapt' ? 'adapt' : 'copy',
      })
    }
  }

  return [...declarationsByPath.values()].sort((a, b) => a.path.localeCompare(b.path))
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

function getDiskReleaseInfos(producerPath = projectRoot): ReleaseInfo[] {
  const intentionsDir = join(producerPath, '.boilerstone', 'migration-intentions')
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
  return listMarkdownFiles(intentionsDir, true).filter((file) => {
    if (
      file.endsWith('README.md') ||
      file.endsWith('classification.md') ||
      file.endsWith('TEMPLATE.md')
    ) {
      return false
    }
    return !isUnreleasedIntentionPath(relative(intentionsDir, file))
  })
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
    for (const issue of parseReferencePathDeclarations(content).issues) {
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

function defaultReleaseReadme(tag: string): string {
  return `# Migration Intentions - ${tag}

## Intentions

${INTENTIONS_BLOCK_BEGIN}

${INTENTIONS_BLOCK_END}
`
}

function cmdIntentionsPromote(version: string): void {
  const semver = version.replace(/^v/, '')
  if (!/^\d+\.\d+\.\d+$/.test(semver)) {
    console.error(`  ${colorize('❌', 'red')} --to must be a version like X.Y.Z (got ${version})`)
    process.exit(1)
  }

  const tag = `v${semver}`
  const unreleasedDir = join(boilerplateDir, 'migration-intentions', 'unreleased')
  const destDir = join(boilerplateDir, 'migration-intentions', tag)
  const skippedNames = new Set(['README.md', 'TEMPLATE.md', 'classification.md'])

  if (!existsSync(unreleasedDir)) {
    console.log(`  ${colorize('✓', 'green')} No unreleased intentions to promote`)
    return
  }

  const sourceFiles = readdirSync(unreleasedDir, { withFileTypes: true })
    .filter(
      (entry) => entry.isFile() && entry.name.endsWith('.md') && !skippedNames.has(entry.name),
    )
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))

  if (sourceFiles.length === 0) {
    console.log(`  ${colorize('✓', 'green')} No unreleased intentions to promote`)
    return
  }

  mkdirSync(destDir, { recursive: true })
  const destReadmePath = join(destDir, 'README.md')
  if (!existsSync(destReadmePath)) {
    writeFileSync(destReadmePath, defaultReleaseReadme(tag), 'utf-8')
    console.log(`  ${colorize('✓', 'green')} Created ${relative(projectRoot, destReadmePath)}`)
  }

  const existingDestFileNames = readdirSync(destDir).filter(
    (name) => name.endsWith('.md') && !skippedNames.has(name),
  )
  const promoted = promoteUnreleasedIntentions({
    files: sourceFiles.map((fileName) => ({
      fileName,
      content: readFileSync(join(unreleasedDir, fileName), 'utf-8'),
    })),
    version: semver,
    existingDestFileNames,
  })

  for (const item of promoted) {
    const destPath = join(destDir, item.destFileName)
    if (existsSync(destPath)) {
      console.error(
        `  ${colorize('❌', 'red')} Refusing to overwrite ${relative(projectRoot, destPath)}`,
      )
      process.exit(1)
    }
  }

  for (const item of promoted) {
    writeFileSync(join(destDir, item.destFileName), item.content, 'utf-8')
  }
  for (const item of promoted) {
    rmSync(join(unreleasedDir, item.sourceFileName))
    console.log(
      `  ${colorize('✓', 'green')} unreleased/${item.sourceFileName} → ${tag}/${item.destFileName} (${item.id})`,
    )
  }

  cmdIntentionsSync()
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

function getReleases(cwd = projectRoot, producerPath = projectRoot): ReleaseInfo[] {
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

  for (const release of getDiskReleaseInfos(producerPath)) {
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
  producerPath?: string
  targetReference?: ResolvedGitReference
}

type PublicationAccessPolicy = 'local-only' | 'refresh-if-needed' | 'refresh-required'

interface ResolveUpgradePathRequest {
  projectPath: string
  producerPath?: string
  sourceVersion?: string
  targetVersion: string
  publicationPolicy: PublicationAccessPolicy
}

interface UpgradePathResolution {
  path: UpgradePath
  branchName: string
  targetRelease: ReleaseInfo
  targetReference: ResolvedGitReference
  sourceReference: ResolvedGitReference | null
  state: TrackingState | null
  warnings: string[]
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

interface PrepareUpgradeRequest extends UpgradePrepareCommandOptions {
  producerPath?: string
  selectIntentions: (path: UpgradePath) => Promise<UpgradePath>
}

interface PreparedUpgrade {
  branchName: string
  sourceVersion: string
  targetVersion: string
  stagedIntentionCount: number
  availableIntentionCount: number
  targetRelease: ReleaseInfo
  targetReference: ResolvedGitReference
  warnings: string[]
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

function syncUpgradeSessionProgress(projectPath: string, state: TrackingState): void {
  const sessionPath = join(projectPath, '.boilerstone', 'upgrade', 'upgrade-session.md')
  if (!existsSync(sessionPath)) {
    return
  }

  const resolvedIds = new Set([
    ...state.intentions.applied.map((intention) => intention.id),
    ...state.intentions.skipped.map((intention) => intention.id),
  ])
  const currentContent = readFileSync(sessionPath, 'utf-8')
  const nextContent = currentContent
    .split('\n')
    .map((line) => {
      if (!line.startsWith('- [ ]')) {
        return line
      }
      const backtickedId = line.match(/`([^`]+)`/)?.[1]
      const legacyId = line.match(/^- \[ \] (v?\d+\.\d+\.\d+\/[^ ]+)/)?.[1]
      const id = backtickedId ?? legacyId
      return id && resolvedIds.has(id) ? line.replace('- [ ]', '- [x]') : line
    })
    .join('\n')

  if (nextContent !== currentContent) {
    writeFileSync(sessionPath, nextContent, 'utf-8')
  }
}

function isValidIntentionId(id: string): boolean {
  return /^v?\d+\.\d+\.\d+(?:\/[a-z0-9-]+)+$/.test(id)
}

function cmdUpgradeRecord(options: UpgradeRecordCommandOptions): void {
  const absolutePath = options.projectPath ? getProjectPath(options.projectPath) : projectRoot
  const currentState = trackingState.read(absolutePath)
  if (!currentState) {
    throw new Error(`No boilerplate.json found in ${absolutePath}`)
  }
  const state =
    options.status === 'applied'
      ? trackingState.record(currentState, { status: 'applied', id: options.id })
      : trackingState.record(currentState, {
          status: 'skipped',
          id: options.id,
          reason: options.reason ?? '',
        })

  trackingState.write(absolutePath, state)
  const recordedId =
    options.status === 'applied'
      ? state.intentions.applied.at(-1)?.id
      : state.intentions.skipped.at(-1)?.id
  console.log(`  ${colorize('✓', 'green')} Recorded ${options.status}: ${recordedId}`)
  try {
    syncUpgradeSessionProgress(absolutePath, state)
  } catch (error) {
    console.warn(
      `  ${colorize('⚠', 'yellow')} Tracking state was saved, but upgrade-session.md could not be synchronized: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

function finishUpgrade(options: UpgradeFinishCommandOptions): UpgradePathResolution {
  const absolutePath = options.projectPath ? getProjectPath(options.projectPath) : projectRoot
  const targetVersion = options.targetVersion.replace(/^v/, '')
  let resolution: UpgradePathResolution
  try {
    resolution = resolveUpgradePath({
      projectPath: absolutePath,
      targetVersion,
      publicationPolicy: 'local-only',
    })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Unknown boilerplate target version:')) {
      const state = trackingState.read(absolutePath)
      throw new Error(
        `Refusing to finish: release v${targetVersion} is not available locally. Fetch the boilerplate releases first: ${getFetchReleasesCommand(getBoilerplateRemote(state))}`,
      )
    }
    throw error
  }

  const state = resolution.state
  if (!state) {
    throw new Error(`No boilerplate.json found in ${absolutePath}`)
  }
  const path = resolution.path
  if (path.intentions.length > 0) {
    throw new Error(
      `Refusing to finish: ${path.intentions.length} intention(s) in v${path.sourceVersion} → v${path.targetVersion} are neither applied nor skipped:\n${path.intentions.map((intention) => `  - ${intention.id}`).join('\n')}\nRecord each one first with boilerplate upgrade record.`,
    )
  }

  trackingState.write(absolutePath, trackingState.finish(state, targetVersion))
  return resolution
}

function cmdUpgradeFinish(options: UpgradeFinishCommandOptions): void {
  const resolution = finishUpgrade(options)
  console.log(
    `  ${colorize('✓', 'green')} Updated source.currentVersion to ${resolution.path.targetVersion}`,
  )
}

function detectSourceVersion(
  projectPath: string,
): { version: string; confidence: 'high' | 'medium' } | null {
  const state = trackingState.read(projectPath)
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

  // 3b. Strip producer test tooling from the vendored package.json.
  const boilerstonePkgPath = join(dir, 'package.json')
  if (existsSync(boilerstonePkgPath)) {
    const boilerstonePkg = JSON.parse(readFileSync(boilerstonePkgPath, 'utf-8')) as PackageJsonShape
    const consumerPkg = ensureConsumerBoilerstonePackageJson(boilerstonePkg)
    if (consumerPkg.changes.length > 0) {
      writeFileSync(boilerstonePkgPath, `${JSON.stringify(consumerPkg.pkg, null, 2)}\n`, 'utf-8')
      for (const change of consumerPkg.changes) {
        console.log(`  ${colorize('✓', 'green')} .boilerstone/package.json: ${change}`)
      }
    }
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

  const existing = trackingState.read(absolutePath)
  if (existing) {
    console.log(`  ${colorize('✓', 'green')} boilerplate.json already exists`)
    console.log(`  ${colorize('Current version:', 'dim')} ${existing.source.currentVersion}`)
    console.log(`  ${colorize('Remote:', 'dim')} ${getBoilerplateRemote(existing)}`)
    console.log(`  ${colorize('Tracked domains:', 'dim')} ${existing.trackedDomains.join(', ')}`)
    return
  }

  const detected = detectSourceVersion(absolutePath)
  const envVersion = process.env.BOILERPLATE_SOURCE_VERSION?.trim().replace(/^v/, '')

  // No trace of a boilerplate version means the project predates the upgrade
  // system: default to 0.0.0 so every intention stays applicable.
  let version = envVersion || '0.0.0'
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
    console.log(
      `  ${colorize('⚠', 'yellow')} Could not detect source version — defaulting to 0.0.0`,
    )
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
  const state = trackingState.create({
    currentVersion: sourceVersion,
    remote: getConfiguredBoilerplateRemote(),
    commit: process.env.BOILERPLATE_SOURCE_COMMIT?.trim() || undefined,
  })

  trackingState.write(absolutePath, state)
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

function formatIntentionPromptItem(intention: MigrationIntention, index: number): string {
  const stopFirst =
    intention.classification === 'breaking-manual'
      ? ' - STOP FIRST: requires human decision before edits'
      : ''
  return `- [ ] ${index + 1}. \`${intention.id}\` (${intention.classification})${stopFirst}`
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

function getIntentionFiles(
  releases: ReleaseInfo[],
  cwd = projectRoot,
  producerPath = projectRoot,
  targetReference?: ResolvedGitReference,
): IntentionFileInput[] {
  return releases.flatMap((release) => {
    const releaseDirInGit = `.boilerstone/migration-intentions/v${release.version}`
    const isTargetReference =
      targetReference?.isDraft === true &&
      release.version === targetReference.label.match(/v(\d+\.\d+\.\d+)/)?.[1]
    if (
      isTargetReference &&
      gitFileExists(targetReference.ref, `${releaseDirInGit}/README.md`, targetReference.cwd)
    ) {
      return listGitMarkdownFiles(targetReference.ref, releaseDirInGit, targetReference.cwd)
        .filter((file) => !file.endsWith('README.md') && !file.endsWith('classification.md'))
        .map((file) => ({
          releaseVersion: release.version,
          file: `${targetReference.label}:${file}`,
          relativePath: file.slice(releaseDirInGit.length + 1),
          content: readGitFile(targetReference.ref, file, targetReference.cwd),
        }))
    }

    // Git tag first: consumers forked before this release only have it in git
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
    const releaseDir = join(
      producerPath,
      '.boilerstone',
      'migration-intentions',
      `v${release.version}`,
    )
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

function computeAvailableUpgradePath(options: ResolveUpgradePathOptions): UpgradePath {
  const releases = options.releases ?? getReleases(options.cwd, options.producerPath)
  return computeUpgradePath({
    sourceVersion: options.sourceVersion,
    targetVersion: options.targetVersion,
    trackedDomains: options.trackedDomains,
    appliedIntentions: options.appliedIntentions,
    skippedIntentions: options.skippedIntentions,
    releases,
    intentionFiles: getIntentionFiles(
      releases,
      options.cwd,
      options.producerPath,
      options.targetReference,
    ),
  })
}

function resolveUpgradePath(options: ResolveUpgradePathRequest): UpgradePathResolution {
  const absolutePath = getProjectPath(options.projectPath)
  const producerPath = options.producerPath ? getProjectPath(options.producerPath) : projectRoot
  const state = trackingState.read(absolutePath)
  const sourceVersionInput = options.sourceVersion ?? state?.source.currentVersion
  if (!sourceVersionInput) {
    if (!state) {
      throw new Error(
        'No boilerplate.json found and no source version was provided. Initialize boilerplate tracking or pass a source version.',
      )
    }
    throw new Error(
      'No source version specified or detected. Initialize boilerplate tracking or pass a source version.',
    )
  }
  const sourceVersion = normalizeSemanticVersion(sourceVersionInput, 'source')
  const requestedTarget =
    options.targetVersion === 'latest'
      ? options.targetVersion
      : normalizeSemanticVersion(options.targetVersion, 'target')

  const warnings: string[] = []
  let releases = getReleases(absolutePath, producerPath)
  const shouldRefresh =
    options.publicationPolicy === 'refresh-required' ||
    (options.publicationPolicy === 'refresh-if-needed' &&
      (options.targetVersion === 'latest' || releases.length === 0))
  if (shouldRefresh) {
    const warning = fetchBoilerplateReleases(absolutePath, state, {
      required: options.publicationPolicy === 'refresh-required',
      report: false,
    })
    if (warning) {
      warnings.push(warning)
    }
    releases = getReleases(absolutePath, producerPath)
  }

  if (releases.length === 0) {
    throw new Error(
      `No local boilerplate releases found. Fetch them with ${getFetchReleasesCommand(getBoilerplateRemote(state))}`,
    )
  }

  const targetVersion = resolveTargetVersion(requestedTarget, releases)
  const targetRelease = releases.find((release) => release.version === targetVersion)
  if (!targetRelease) {
    throw new Error(`Unknown boilerplate target version: ${requestedTarget}`)
  }
  if (compareVersions(targetVersion, sourceVersion) < 0) {
    throw new Error(`Cannot downgrade from ${sourceVersion} to ${targetVersion}`)
  }
  const targetReference = resolveTargetReference(targetRelease, absolutePath, producerPath)

  const path = computeAvailableUpgradePath({
    sourceVersion,
    targetVersion,
    trackedDomains: state?.trackedDomains ?? [],
    appliedIntentions: state?.intentions.applied.map((intention) => intention.id) ?? [],
    skippedIntentions: state?.intentions.skipped.map((intention) => intention.id) ?? [],
    releases,
    cwd: absolutePath,
    producerPath,
    targetReference,
  })
  const sourceRelease = releases.find((release) => release.version === path.sourceVersion)
  let sourceReference: ResolvedGitReference | null = null
  if (sourceRelease) {
    try {
      sourceReference = resolveTargetReference(sourceRelease, absolutePath, producerPath)
    } catch {
      warnings.push(`No source publication is available for ${path.sourceTag}`)
    }
  }

  return {
    path,
    branchName: getUpgradeBranchName(path.sourceVersion, path.targetVersion),
    targetRelease,
    targetReference,
    sourceReference,
    state,
    warnings,
  }
}

function cmdUpgradePath(options: UpgradePathCommandOptions): void {
  const absolutePath = options.projectPath ? getProjectPath(options.projectPath) : projectRoot
  const resolution = resolveUpgradePath({
    projectPath: absolutePath,
    sourceVersion: options.fromVersion || undefined,
    targetVersion: options.toVersion,
    publicationPolicy: options.fetch ? 'refresh-required' : 'local-only',
  })
  const { path, branchName } = resolution

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          ...path,
          branchName,
          targetRelease: resolution.targetRelease,
          targetReference: resolution.targetReference,
          warnings: resolution.warnings,
        },
        null,
        2,
      ),
    )
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
  console.log(
    `  ${colorize('Target publication:', 'dim')} ${colorize(resolution.targetReference.label, 'bright')} (${resolution.targetReference.provenance})`,
  )
  console.log(`  ${colorize('Releases:', 'dim')} ${path.releases.length}`)
  console.log(`  ${colorize('Already applied/skipped:', 'dim')} ${path.alreadyResolvedCount}`)
  console.log(`  ${colorize('Migration intentions:', 'dim')} ${migrationIntentions.length}`)
  console.log(
    `  ${colorize('Breaking/manual intentions:', 'dim')} ${breakingManualIntentions.length}`,
  )
  console.log(`  ${colorize('Metadata warnings:', 'dim')} ${metadataIssueCount}`)
  for (const warning of resolution.warnings) {
    console.log(`  ${colorize('Publication warning:', 'dim')} ${warning}`)
  }

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
  const state = trackingState.read(absolutePath)
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
  const state = trackingState.read(projectPath)

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
            'This is expected in the boilerplate repository; generated or onboarded projects should re-run `pnpm boilerplate bootstrap` (or `pnpm rock` on a fresh template) to drop producer artifacts',
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

async function prepareUpgrade(options: PrepareUpgradeRequest): Promise<PreparedUpgrade> {
  const absolutePath = options.projectPath ? getProjectPath(options.projectPath) : projectRoot
  const state = trackingState.read(absolutePath)
  if (!state) {
    throw new Error(
      `No boilerplate.json found. Run boilerplate upgrade init --project ${options.projectPath} first.`,
    )
  }
  const dirtyOutput = runGitCommand(['status', '--porcelain'], absolutePath)
  if (dirtyOutput) {
    throw new Error(
      `Git worktree is dirty. Clean before upgrading. Inspect changes with git -C ${quotePosixShellArgument(absolutePath)} status --short`,
    )
  }
  const upgradeDir = join(absolutePath, '.boilerstone', 'upgrade')
  if (existsSync(upgradeDir)) {
    throw new Error(
      'An upgrade workspace already exists. Finish it, remove it, or use a fresh branch before preparing again.',
    )
  }

  const requestedVersion = options.toVersion || 'latest'
  const resolution = resolveUpgradePath({
    projectPath: absolutePath,
    producerPath: options.producerPath,
    targetVersion: requestedVersion,
    publicationPolicy: options.fetch ? 'refresh-required' : 'refresh-if-needed',
  })
  if (resolution.targetReference.provenance === 'producer-draft') {
    // Scoped to .boilerstone/: that is the tree a draft serves (intentions and
    // reference archives read from HEAD). Build artifacts elsewhere in the
    // checkout must not block preparation; app-code reference paths are
    // covered by the runbook's commit-first rule.
    if (
      runGitCommand(['status', '--porcelain', '--', '.boilerstone'], resolution.targetReference.cwd)
    ) {
      throw new Error(
        'Producer .boilerstone/ has uncommitted changes. Commit or discard them before preparation.',
      )
    }
  }
  const resolvedPath = resolution.path
  const warnings = [...resolution.warnings]

  if (resolvedPath.intentions.length === 0) {
    if (resolvedPath.alreadyResolvedCount > 0) {
      throw new Error(
        `No intentions apply between v${resolvedPath.sourceVersion} and v${resolvedPath.targetVersion} — all ${resolvedPath.alreadyResolvedCount} intention(s) in range are already applied or skipped. Run boilerplate upgrade finish --to ${resolvedPath.targetVersion}.`,
      )
    }
    throw new Error(
      `No intentions apply between v${resolvedPath.sourceVersion} and v${resolvedPath.targetVersion} — nothing to prepare. Intentions tagged v${resolvedPath.sourceVersion} are never replayed. If this project predates them, lower source.currentVersion in .boilerstone/boilerplate.json (e.g. 0.0.0); otherwise run boilerplate upgrade finish --to ${resolvedPath.targetVersion}.`,
    )
  }

  const filteredPath = filterUpgradePathIntentions(
    resolvedPath,
    options.includeIds,
    options.excludeIds,
  )
  const upgradePath = await options.selectIntentions(filteredPath)

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
    throw new Error(
      missingDependencies
        .map(
          ({ id, requires }) =>
            `${id} requires ${requires} — include it in the selection or resolve it first.`,
        )
        .join('\n'),
    )
  }

  const branchName = resolution.branchName
  const targetReference = resolution.targetReference
  const temporaryUpgradeDir = join(
    absolutePath,
    '.boilerstone',
    `upgrade.tmp-${process.pid}-${Date.now()}`,
  )
  let isPublished = false

  try {
    mkdirSync(join(temporaryUpgradeDir, 'reference', 'source'), { recursive: true })
    mkdirSync(join(temporaryUpgradeDir, 'reference', 'target'), { recursive: true })
    mkdirSync(join(temporaryUpgradeDir, 'intentions'), { recursive: true })

    const orderWidth = Math.max(2, String(upgradePath.intentions.length).length)
    for (const [index, intention] of upgradePath.intentions.entries()) {
      // Content was resolved from the release git tag (or disk fallback); write it
      // instead of copying, since the source may not exist as a local file
      const order = String(index + 1).padStart(orderWidth, '0')
      const destFile = join(
        temporaryUpgradeDir,
        'intentions',
        `${order}-${intention.id.replace(/\//g, '-')}.md`,
      )
      writeFileSync(destFile, intention.content, 'utf-8')
    }

    // Source and target are independent: a 0.0.0 project has no source ref, but
    // the complete target remains mandatory.
    const referenceDeclarations = getReferencePathDeclarations(upgradePath.intentions)
    let stagedSourceReferencePaths: string[] = []
    const sourceReference = resolution.sourceReference
    const sourceRef = sourceReference?.ref ?? upgradePath.sourceTag
    if (sourceReference) {
      archiveGitReference(
        sourceReference.ref,
        join(temporaryUpgradeDir, 'reference', 'source'),
        sourceReference.cwd,
      )
      stagedSourceReferencePaths = extractIntentionReferencePaths(
        upgradePath.intentions,
        sourceReference.ref,
        join(temporaryUpgradeDir, 'reference', 'source'),
        sourceReference.cwd,
      )
    } else {
      writeFileSync(
        join(temporaryUpgradeDir, 'reference', 'source', 'NO-SOURCE-REFERENCE.md'),
        `Release ${upgradePath.sourceTag} does not exist locally — the project predates the first tracked release. Compare against reference/target/ only.\n`,
        'utf-8',
      )
      warnings.push(
        `No source reference for ${upgradePath.sourceTag} (release not found) — comparing against the target only`,
      )
    }

    archiveGitReference(
      targetReference.ref,
      join(temporaryUpgradeDir, 'reference', 'target'),
      targetReference.cwd,
    )
    const stagedTargetReferencePaths = extractIntentionReferencePaths(
      upgradePath.intentions,
      targetReference.ref,
      join(temporaryUpgradeDir, 'reference', 'target'),
      targetReference.cwd,
    )
    const stagedTargetPaths = new Set(stagedTargetReferencePaths)
    const missingCopyPath = referenceDeclarations.find(
      (declaration) => declaration.mode === 'copy' && !stagedTargetPaths.has(declaration.path),
    )
    if (missingCopyPath) {
      throw new Error(`copy reference path is missing from the target ref: ${missingCopyPath.path}`)
    }

    const referenceContext: SessionReferenceContext = {
      declarations: referenceDeclarations,
      sourceRef,
      targetRef: targetReference.ref,
      targetCwd: targetReference.cwd,
      targetLabel: targetReference.label,
      isTargetDraft: targetReference.isDraft,
      stagedSourcePaths: stagedSourceReferencePaths,
      stagedTargetPaths: stagedTargetReferencePaths,
    }
    writeFileSync(
      join(temporaryUpgradeDir, 'reference', 'README.md'),
      generateReferenceReadme(referenceContext),
      'utf-8',
    )
    const sessionPrompt = generateSessionPrompt(upgradePath, state, referenceContext)
    writeFileSync(join(temporaryUpgradeDir, 'upgrade-session.md'), sessionPrompt, 'utf-8')

    ensureUpgradeBranch(absolutePath, branchName)
    renameSync(temporaryUpgradeDir, upgradeDir)
    isPublished = true

    return {
      branchName,
      sourceVersion: upgradePath.sourceVersion,
      targetVersion: upgradePath.targetVersion,
      stagedIntentionCount: upgradePath.intentions.length,
      availableIntentionCount: resolvedPath.intentions.length,
      targetRelease: resolution.targetRelease,
      targetReference,
      warnings,
    }
  } finally {
    if (!isPublished) {
      rmSync(temporaryUpgradeDir, { recursive: true, force: true })
    }
  }
}

async function cmdUpgradePrepare(options: UpgradePrepareCommandOptions): Promise<void> {
  console.log(`\n${colorize('📦 Preparing Upgrade Context', 'cyan')}\n`)

  const interactiveSelect =
    options.select === true ||
    (process.stdin.isTTY === true &&
      options.includeIds.length === 0 &&
      options.excludeIds.length === 0)
  const result = await prepareUpgrade({
    ...options,
    selectIntentions: interactiveSelect
      ? selectUpgradePathIntentions
      : async (path: UpgradePath): Promise<UpgradePath> => path,
  })

  for (const warning of result.warnings) {
    console.log(`  ${colorize('⚠', 'yellow')} ${warning}`)
  }
  console.log(
    `  ${colorize('→', 'cyan')} Working on branch: ${colorize(result.branchName, 'bright')}`,
  )
  console.log(
    `  ${colorize('✓', 'green')} Target source of truth: ${colorize(result.targetReference.label, 'bright')} (${result.targetReference.provenance})`,
  )
  console.log(`  ${colorize('✓', 'green')} Created .boilerstone/upgrade/ workspace`)
  console.log(`  ${colorize('✓', 'green')} Generated upgrade-session.md`)
  console.log(
    `  ${colorize('→', 'cyan')} ${result.stagedIntentionCount}/${result.availableIntentionCount} intentions ready for execution`,
  )
  console.log()
}

interface SessionReferenceContext {
  declarations: ReferencePathDeclaration[]
  sourceRef: string
  targetRef: string
  targetCwd: string
  targetLabel: string
  isTargetDraft: boolean
  stagedSourcePaths: string[]
  stagedTargetPaths: string[]
}

function formatReferencePolicyTable(context: SessionReferenceContext): string {
  if (context.declarations.length === 0) {
    return '_No app-code reference paths declared._'
  }

  const sourcePaths = new Set(context.stagedSourcePaths)
  const targetPaths = new Set(context.stagedTargetPaths)
  const rows = context.declarations.map(
    ({ path, mode }) =>
      `| \`${path}\` | ${mode} | ${sourcePaths.has(path) ? 'staged' : 'not available'} | ${targetPaths.has(path) ? 'staged' : 'not available'} |`,
  )

  return [
    '| Path | Policy | Source projection | Target projection |',
    '| --- | --- | --- | --- |',
    ...rows,
  ].join('\n')
}

function formatReferenceGitCommand(context: SessionReferenceContext, args: string): string {
  return `git -C ${quotePosixShellArgument(context.targetCwd)} ${args}`
}

function generateReferenceReadme(context: SessionReferenceContext): string {
  const draftNotice = context.isTargetDraft
    ? '\n> Draft mode: the producer checkout HEAD is the temporary source of truth until the release is tagged.\n'
    : ''

  return `# Upgrade References

- Source ref: \`${context.sourceRef}\`
- Target ref (source of truth): \`${context.targetLabel}\`
${draftNotice}

\`reference/target/\` is a disposable projection of the target ref. \`reference/source/\` is the matching source projection. They make review convenient for human and AI executors; the refs remain authoritative.

## Reference Policy

- **copy**: copy the target projection verbatim; it is the declared source of truth for that path.
- **adapt**: compare the project with both projections, preserve project-specific deltas, and apply only the source-to-target change. If the source projection is unavailable, preserve project behavior and use the target only as a reference.

${formatReferencePolicyTable(context)}

Inspect a target file without using the projection:

\`\`\`bash
${formatReferenceGitCommand(context, `show ${context.targetRef}:<path>`)}
${formatReferenceGitCommand(context, `archive ${context.targetRef} -- <path>`)} | tar -x -C .boilerstone/upgrade/reference/target/
\`\`\`
`
}

function generateSessionPrompt(
  path: UpgradePath,
  state: TrackingState,
  referenceContext: SessionReferenceContext,
): string {
  const targetTag = `v${path.targetVersion}`
  const remoteUrl = getBoilerplateRemote(state)
  const fullReferenceFallback = referenceContext.isTargetDraft
    ? `${formatReferenceGitCommand(referenceContext, `archive ${referenceContext.targetRef} -- <path>`)} | tar -x -C .boilerstone/upgrade/reference/target/`
    : `git clone --depth 1 --branch ${quotePosixShellArgument(targetTag)} ${quotePosixShellArgument(remoteUrl)} ${quotePosixShellArgument('.boilerstone/upgrade/reference/full')}`

  return `# Upgrade Session: v${path.sourceVersion} → v${path.targetVersion}

## Instructions

You are the executor — a developer or an AI agent — applying boilerplate upgrade intentions to this project.

### Rules

1. **Propose first (agents):** before any edit or skip record, read every pending intention below, inspect the project, and present an apply / skip / ask table to the human. Wait for confirmation.
2. **Anti-pattern:** never skip because the project is still on the stack this intention migrates away from (ESLint/Prettier, Better Auth \`pg\` pool, MikroORM below v7, missing Knip, …). That is evidence to **apply**.
3. Soft skips (optional capability unused) still need human confirmation before \`upgrade record --skipped\`.
4. Work **one confirmed intention at a time** (or a small batch the human explicitly allowed)
5. Read each intention file before starting
6. Re-check "Applies when" / "Do not apply when" — if a hard skip now seems clear, re-propose to the human; do not silently skip
7. For \`breaking-manual\` intentions, **stop before editing files** and write a blocked report describing the required human decision
8. Follow the declared Reference Policy for every path; never write a referenced file from memory
9. **copy**: copy the target projection verbatim and verify the resulting diff
10. **adapt**: compare project, source, and target before editing; preserve project-specific deltas and apply only the source-to-target change
11. Everywhere else apply the **smallest safe change** and **preserve** all project-specific behavior
12. Run validation after each intention
13. After successful validation, record the outcome with \`pnpm boilerplate upgrade record --id <id> --applied\` (or \`--skipped --reason "..."\` only after human confirmation)
14. **Stop** on unsafe ambiguity and write a blocked report
15. After the last intention is resolved, run \`pnpm boilerplate upgrade finish --to ${path.targetVersion}\`

### Git Policy

- Commit after each resolved intention for risky upgrades; small supervised batches may commit multiple recorded intentions together after validation
- Never rewrite divergent files wholesale
- Never apply cosmetic alignment unless required
- Do not mark an intention as applied before validation passes
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

- Target ref (source of truth): \`${referenceContext.targetLabel}\`
- Reference provenance: \`.boilerstone/upgrade/reference/README.md\`
- Source reference: \`.boilerstone/upgrade/reference/source/\`
- Target reference: \`.boilerstone/upgrade/reference/target/\`
- Intention files: \`.boilerstone/upgrade/intentions/\`

### Reference Policy

- **copy**: copy the target projection verbatim.
- **adapt**: compare project, source, and target; preserve project-specific behavior.

${formatReferencePolicyTable(referenceContext)}

Need a reference file that is not staged? Extract it from the target tag:

\`\`\`bash
${formatReferenceGitCommand(referenceContext, `archive ${referenceContext.targetRef} -- <path>`)} | tar -x -C .boilerstone/upgrade/reference/target/
# Full reference fallback:
${fullReferenceFallback}
\`\`\`

Begin with the apply/skip proposal table for the human, then the first confirmed intention.
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
  ${colorize('intentions promote', 'bright')}         Move unreleased/ intentions into vX.Y.Z/ (release time)
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
  ${colorize('boilerplate intentions promote --to 1.2.0', 'dim')}
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
      } else if (subcommand === 'promote') {
        const to = readOptionValue(args, '--to')
        if (!to) {
          console.error(`  ${colorize('❌', 'red')} --to is required`)
          process.exit(1)
        }
        cmdIntentionsPromote(to)
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

export {
  archiveGitReference,
  extractIntentionReferencePaths,
  finishUpgrade,
  generateReferenceReadme,
  generateSessionPrompt,
  getFetchReleasesCommand,
  prepareUpgrade,
  resolveUpgradePath,
  resolveTargetReference,
  type PrepareUpgradeRequest,
  type PreparedUpgrade,
  type ResolveUpgradePathRequest,
  type ResolvedGitReference,
  type SessionReferenceContext,
  type UpgradePathResolution,
}
