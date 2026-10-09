interface ReleaseInfo {
  version: string
  tag: string
  date: string
  hasMigrations: boolean
}

type IntentionClassification = 'no-migration' | 'informational' | 'migration' | 'breaking-manual'

interface MigrationIntention {
  id: string
  file: string
  content: string
  domain?: string
  classification: IntentionClassification
  requires: string[]
  metadataIssues: string[]
}

interface IntentionMetadata {
  id?: string
  domain?: string
  classification?: IntentionClassification
  requires?: string[]
}

interface ParsedIntentionMetadata {
  metadata: IntentionMetadata
  issues: string[]
}

interface IntentionFileInput {
  releaseVersion: string
  file: string
  relativePath: string
  content: string
}

interface ComputeUpgradePathOptions {
  sourceVersion: string
  targetVersion: string
  trackedDomains: string[]
  appliedIntentions: string[]
  skippedIntentions: string[]
  releases: ReleaseInfo[]
  intentionFiles: IntentionFileInput[]
}

interface UpgradePath {
  sourceVersion: string
  targetVersion: string
  releases: string[]
  intentions: MigrationIntention[]
  sourceTag: string
  targetTag: string
  classificationCounts: Record<IntentionClassification, number>
  skippedByDomain: Record<string, number>
  alreadyResolvedCount: number
}

function isIntentionClassification(value: string): value is IntentionClassification {
  return ['no-migration', 'informational', 'migration', 'breaking-manual'].includes(value)
}

function parseIntentionMetadataContent(content: string): ParsedIntentionMetadata {
  // Frontmatter must open on the very first line; tolerate CRLF files
  const match = content.match(/^---\r?\n(?<body>[\s\S]*?)\r?\n---/)
  if (!match?.groups?.body) {
    return {
      metadata: {},
      issues: ['missing frontmatter', 'missing id', 'missing domain', 'missing classification'],
    }
  }

  const metadata: IntentionMetadata = {}
  const issues: string[] = []
  let inRequiresList = false
  for (const line of match.groups.body.split(/\r?\n/)) {
    // YAML block-list items belong to a preceding `requires:` line
    const listItem = line.match(/^\s+-\s+(.+)$/)
    if (inRequiresList && listItem) {
      metadata.requires = [...(metadata.requires ?? []), listItem[1].trim()]
      continue
    }
    inRequiresList = false

    const [rawKey, ...rawValue] = line.split(':')
    const key = rawKey?.trim()
    const value = rawValue.join(':').trim()
    if (key === 'requires') {
      if (value) {
        metadata.requires = [...(metadata.requires ?? []), value]
      } else {
        inRequiresList = true
      }
      continue
    }
    if (!key || !value) {
      continue
    }

    if (key === 'id') {
      metadata.id = value
    } else if (key === 'domain') {
      metadata.domain = value
    } else if (key === 'classification') {
      if (isIntentionClassification(value)) {
        metadata.classification = value
      } else {
        issues.push(`invalid classification: ${value}`)
      }
    }
  }

  if (!metadata.id) {
    issues.push('missing id')
  }
  if (!metadata.domain) {
    issues.push('missing domain')
  }
  if (!metadata.classification) {
    issues.push('missing classification')
  }

  return { metadata, issues }
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = i < pa.length ? pa[i] : 0
    const db = i < pb.length ? pb[i] : 0
    if (da !== db) {
      return da - db
    }
  }
  return 0
}

function versionGt(a: string, b: string): boolean {
  return compareVersions(a, b) > 0
}

function versionLte(a: string, b: string): boolean {
  return compareVersions(a, b) <= 0
}

function getFallbackIntentionId(version: string, relativePath: string): string {
  // Filenames carry an execution-order prefix (NN-slug.md); ids never do.
  const withoutExtension = relativePath.replace(/\.md$/, '')
  const segments = withoutExtension.split('/')
  segments[segments.length - 1] = segments[segments.length - 1].replace(/^\d+-/, '')
  return `v${version}/${segments.join('/')}`
}

function getUpgradeBranchName(sourceVersion: string, targetVersion: string): string {
  return `upgrade/v${sourceVersion}-to-v${targetVersion}`
}

function readOptionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  if (index === -1) {
    return undefined
  }

  const value = args[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value`)
  }

  return value
}

function createClassificationCounts(): Record<IntentionClassification, number> {
  return {
    'no-migration': 0,
    informational: 0,
    migration: 0,
    'breaking-manual': 0,
  }
}

function computeUpgradePath(options: ComputeUpgradePathOptions): UpgradePath {
  const classificationCounts = createClassificationCounts()
  const skippedByDomain: Record<string, number> = {}
  let alreadyResolvedCount = 0

  const sourceTag =
    options.releases.find((r) => r.version === options.sourceVersion)?.tag ||
    `v${options.sourceVersion}`
  const targetTag =
    options.releases.find((r) => r.version === options.targetVersion)?.tag ||
    `v${options.targetVersion}`

  const releasesInRange = options.releases
    .filter(
      (release) =>
        versionGt(release.version, options.sourceVersion) &&
        versionLte(release.version, options.targetVersion),
    )
    .sort((a, b) => compareVersions(a.version, b.version))

  const intentions: MigrationIntention[] = []

  for (const release of releasesInRange) {
    const releaseIntentionFiles = options.intentionFiles
      .filter((file) => file.releaseVersion === release.version)
      .sort((a, b) => a.relativePath.localeCompare(b.relativePath))

    for (const file of releaseIntentionFiles) {
      const parsedMetadata = parseIntentionMetadataContent(file.content)
      const metadata = parsedMetadata.metadata
      const intentionId = metadata.id || getFallbackIntentionId(release.version, file.relativePath)
      const pathDomain = file.relativePath.includes('/')
        ? file.relativePath.split('/')[0]
        : undefined
      const domain = metadata.domain || pathDomain
      const classification = metadata.classification || 'migration'
      classificationCounts[classification] += 1

      if (
        options.appliedIntentions.includes(intentionId) ||
        options.skippedIntentions.includes(intentionId)
      ) {
        alreadyResolvedCount += 1
        continue
      }

      if (options.trackedDomains.length > 0 && domain && !options.trackedDomains.includes(domain)) {
        skippedByDomain[domain] = (skippedByDomain[domain] || 0) + 1
        continue
      }

      if (classification === 'no-migration' || classification === 'informational') {
        continue
      }

      intentions.push({
        id: intentionId,
        file: file.file,
        content: file.content,
        domain,
        classification,
        requires: metadata.requires ?? [],
        metadataIssues: parsedMetadata.issues,
      })
    }
  }

  return {
    sourceVersion: options.sourceVersion,
    targetVersion: options.targetVersion,
    releases: releasesInRange.map((r) => r.tag),
    intentions,
    sourceTag,
    targetTag,
    classificationCounts,
    skippedByDomain,
    alreadyResolvedCount,
  }
}

const CLI_PACKAGE_NAME = '@lonestone/boilerstone-cli'
// The default source of boilerplate releases, used unless BOILERPLATE_REPO overrides it.
const BOILERPLATE_REMOTE = 'https://github.com/lonestone/lonestone-boilerplate.git'
// The command the package installs (its `bin`).
const CLI_BIN_NAME = 'boilerstone-cli'
const BOILERPLATE_SCRIPT_NAME = 'boilerplate'
const ROCK_SCRIPT_NAME = 'rock'
// Consumers never install the CLI: their scripts run it through `pnpm dlx`.
// Upgrades always use the newest CLI; `rock` stays on the project's release.
const BOILERPLATE_SCRIPT_COMMAND = `pnpm dlx ${CLI_PACKAGE_NAME}@latest`
const PINNED_ROCK_SCRIPT_PATTERN = /^pnpm dlx @lonestone\/boilerstone-cli@\S+ rock$/
// The boilerplate repository itself runs its workspace copy of the CLI.
const TEMPLATE_ROCK_SCRIPT_COMMAND = `${CLI_BIN_NAME} rock`
const LEGACY_BOILERPLATE_SCRIPT_COMMANDS = ['tsx ./.boilerstone/cli/boilerplate.ts', CLI_BIN_NAME]

function getRockScriptCommand(version: string): string {
  return `pnpm dlx ${CLI_PACKAGE_NAME}@${version} rock`
}

// Producer-only artifacts that ship inside .boilerstone/ but are not maintained
// in a consumer project. Paths are relative to the .boilerstone/ directory.
const PRODUCER_ARTIFACTS = [
  'migration-intentions',
  'boilerplate.example.json',
  'docs/pilot-rollout.md',
  'docs/ai-upgrades-implementation.md',
  'docs/release-maintainer-runbook.md',
  'cli',
  'package.json',
  'tsconfig.json',
  'vitest.config.ts',
]

interface PackageJsonShape {
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  [key: string]: unknown
}

interface PackageJsonWiring {
  pkg: PackageJsonShape
  changes: string[]
}

/**
 * Returns a copy of an existing project's root package.json with the
 * `boilerplate` script running the published CLI through `pnpm dlx`. Replaces
 * a missing or legacy vendored command, keeps a custom one. Leaves `rock` and
 * every dependency alone: on an existing project those belong to the project
 * (the adopt-published-cli intention migrates them with a human in the loop).
 */
function ensurePackageJsonWiring(pkg: PackageJsonShape): PackageJsonWiring {
  const scripts = { ...pkg.scripts }
  const currentScript = scripts[BOILERPLATE_SCRIPT_NAME]
  if (currentScript && !LEGACY_BOILERPLATE_SCRIPT_COMMANDS.includes(currentScript)) {
    return { pkg, changes: [] }
  }
  scripts[BOILERPLATE_SCRIPT_NAME] = BOILERPLATE_SCRIPT_COMMAND
  return {
    pkg: { ...pkg, scripts },
    changes: [`set "${BOILERPLATE_SCRIPT_NAME}" script to ${BOILERPLATE_SCRIPT_COMMAND}`],
  }
}

function withoutCliDependency(
  dependencies: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!dependencies?.[CLI_PACKAGE_NAME]) {
    return dependencies
  }
  const rest = { ...dependencies }
  delete rest[CLI_PACKAGE_NAME]
  return rest
}

/**
 * Returns a copy of a template's root package.json as a generated project
 * needs it: both scripts run the published CLI through `pnpm dlx` (`rock`
 * pinned to the release the project starts from), and the workspace
 * dependency on the CLI sources is gone, so installing the project never
 * needs the Lonestone package.
 */
function wireGeneratedPackageJson(pkg: PackageJsonShape, version: string): PackageJsonShape {
  return {
    ...pkg,
    scripts: {
      ...pkg.scripts,
      [BOILERPLATE_SCRIPT_NAME]: BOILERPLATE_SCRIPT_COMMAND,
      [ROCK_SCRIPT_NAME]: getRockScriptCommand(version),
    },
    dependencies: withoutCliDependency(pkg.dependencies),
    devDependencies: withoutCliDependency(pkg.devDependencies),
  }
}

/**
 * Moves a pinned `pnpm dlx @lonestone/boilerstone-cli@<version> rock` script to another
 * release. Returns null when `rock` is custom or still the vendored script:
 * those belong to the project.
 */
function pinRockScript(pkg: PackageJsonShape, version: string): PackageJsonShape | null {
  const current = pkg.scripts?.[ROCK_SCRIPT_NAME]
  const next = getRockScriptCommand(version)
  if (!current || !PINNED_ROCK_SCRIPT_PATTERN.test(current) || current === next) {
    return null
  }
  return { ...pkg, scripts: { ...pkg.scripts, [ROCK_SCRIPT_NAME]: next } }
}

/**
 * Resolves a requested target version, expanding the `latest` keyword to the
 * newest available release. Any other value is returned unchanged.
 */
function resolveTargetVersion(requested: string, releases: ReleaseInfo[]): string {
  if (requested !== 'latest') {
    return requested
  }
  if (releases.length === 0) {
    throw new Error(
      'Cannot resolve "latest": no boilerplate releases are available (fetch release tags first)',
    )
  }
  return [...releases].sort((a, b) => compareVersions(b.version, a.version))[0].version
}

interface IntentionOrderInput {
  id: string
  file: string
  requires: string[]
}

/**
 * Validates the `requires:` graph against the on-disk execution order
 * (filename-prefix order, as passed in). Dependencies must exist and appear
 * earlier — same-release cycles surface as an order violation by construction.
 */
function getIntentionOrderIssues(
  intentions: IntentionOrderInput[],
): Array<{ file: string; issue: string }> {
  const issues: Array<{ file: string; issue: string }> = []
  const positionById = new Map(intentions.map((intention, index) => [intention.id, index]))

  intentions.forEach((intention, index) => {
    for (const requiredId of intention.requires) {
      const requiredPosition = positionById.get(requiredId)
      if (requiredPosition === undefined) {
        issues.push({ file: intention.file, issue: `unknown requires: ${requiredId}` })
        continue
      }
      if (requiredPosition >= index) {
        issues.push({
          file: intention.file,
          issue: `requires ${requiredId}, which must come earlier in execution order (filename prefix)`,
        })
      }
    }
  })

  return issues
}

/**
 * Parses the repo-relative paths and copy/adapt policy declared in an
 * intention's "## Reference Paths" section. Published legacy intentions
 * without a policy remain safe by defaulting to adapt, while producer lint can
 * surface the returned issue.
 */
type ReferencePathMode = 'copy' | 'adapt'

interface ReferencePathDeclaration {
  path: string
  mode: ReferencePathMode
}

interface ParsedReferencePathDeclarations {
  references: ReferencePathDeclaration[]
  issues: string[]
}

function parseReferencePathDeclarations(content: string): ParsedReferencePathDeclarations {
  const lines = content.split('\n')
  const sectionStart = lines.findIndex((line) => line.trim() === '## Reference Paths')
  if (sectionStart === -1) {
    return { references: [], issues: [] }
  }

  const referencesByPath = new Map<string, ReferencePathDeclaration>()
  const issues: string[] = []
  for (const line of lines.slice(sectionStart + 1)) {
    if (line.startsWith('## ')) {
      break
    }
    if (!line.trim().startsWith('-')) {
      continue
    }
    const modeMatch = line.match(/(?:—|-)\s*\**(copy|adapt)\**\s*$/i)
    const mode = (modeMatch?.[1]?.toLowerCase() as ReferencePathMode | undefined) ?? 'adapt'
    for (const match of line.matchAll(/`([^`]+)`/g)) {
      const candidate = match[1].trim().replace(/\/+$/, '')
      if (
        candidate &&
        !candidate.includes(' ') &&
        !candidate.includes('://') &&
        !candidate.startsWith('.boilerstone')
      ) {
        const current = referencesByPath.get(candidate)
        referencesByPath.set(candidate, {
          path: candidate,
          mode: current?.mode === 'adapt' || mode === 'adapt' ? 'adapt' : 'copy',
        })
        if (!modeMatch) {
          issues.push(`reference path ${candidate} must declare copy or adapt`)
        }
      }
    }
  }

  return {
    references: [...referencesByPath.values()].sort((a, b) => a.path.localeCompare(b.path)),
    issues: [...new Set(issues)],
  }
}

function parseReferencePaths(content: string): string[] {
  return parseReferencePathDeclarations(content).references.map((reference) => reference.path)
}

/**
 * Appends a line to .gitignore content if it is not already present.
 * Idempotent and newline-safe.
 */
function ensureGitignoreLine(content: string, line: string): { content: string; changed: boolean } {
  const exists = content.split(/\r?\n/).some((existing) => existing.trim() === line)
  if (exists) {
    return { content, changed: false }
  }
  const needsLeadingNewline = content.length > 0 && !content.endsWith('\n')
  return { content: `${content}${needsLeadingNewline ? '\n' : ''}${line}\n`, changed: true }
}

/**
 * True when a path under `migration-intentions/` is in the PR-time staging
 * directory. Published lint (`intentions lint`) must ignore these files:
 * their ids are `unreleased/slug`, which is not a valid published intention id.
 */
function isUnreleasedIntentionPath(relativePathFromIntentionsRoot: string): boolean {
  const normalized = relativePathFromIntentionsRoot.replaceAll('\\', '/')
  return normalized === 'unreleased' || normalized.startsWith('unreleased/')
}

function normalizeReleaseTag(version: string): string {
  return version.startsWith('v') ? version : `v${version}`
}

function rewriteUnreleasedIdsInFrontmatter(content: string, releaseTag: string): string {
  const match = content.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/)
  if (!match) {
    return content
  }
  const prefix = `${releaseTag}/`
  const rewritten = match[2]
    .replace(/^(id:\s*)unreleased\//m, `$1${prefix}`)
    .replace(/^(requires:\s*)unreleased\//m, `$1${prefix}`)
    .replace(/^(\s+-\s+)unreleased\//gm, `$1${prefix}`)
  return `${match[1]}${rewritten}${match[3]}${content.slice(match[0].length)}`
}

interface UnreleasedIntentionFile {
  fileName: string
  content: string
}

interface PromotedIntentionFile {
  sourceFileName: string
  destFileName: string
  content: string
  id: string
}

interface PromoteUnreleasedIntentionsOptions {
  files: UnreleasedIntentionFile[]
  version: string
  existingDestFileNames?: string[]
}

function nextOrderIndex(existingDestFileNames: string[]): number {
  let max = -1
  for (const name of existingDestFileNames) {
    const match = name.match(/^(\d+)-/)
    if (match) {
      max = Math.max(max, Number(match[1]))
    }
  }
  return max + 1
}

function intentionSlugFromFileName(fileName: string): string {
  return fileName.replace(/\.md$/, '').replace(/^\d+-/, '')
}

/**
 * Assigns `NN-` prefixes in filename-sort order and rewrites `unreleased/`
 * ids (and `requires:` entries) to `vX.Y.Z/`. Does not invent a dependency
 * graph — the maintainer can rename `NN` afterwards.
 */
function promoteUnreleasedIntentions(
  options: PromoteUnreleasedIntentionsOptions,
): PromotedIntentionFile[] {
  const releaseTag = normalizeReleaseTag(options.version)
  const skippedNames = new Set(['README.md', 'TEMPLATE.md', 'classification.md'])
  const files = options.files
    .filter((file) => file.fileName.endsWith('.md') && !skippedNames.has(file.fileName))
    .sort((a, b) => a.fileName.localeCompare(b.fileName))

  let index = nextOrderIndex(options.existingDestFileNames ?? [])
  return files.map((file) => {
    const slug = intentionSlugFromFileName(file.fileName)
    const destFileName = `${String(index).padStart(2, '0')}-${slug}.md`
    index += 1
    const content = rewriteUnreleasedIdsInFrontmatter(file.content, releaseTag)
    const parsed = parseIntentionMetadataContent(content)
    return {
      sourceFileName: file.fileName,
      destFileName,
      content,
      id: parsed.metadata.id || `${releaseTag}/${slug}`,
    }
  })
}

export {
  BOILERPLATE_REMOTE,
  BOILERPLATE_SCRIPT_COMMAND,
  BOILERPLATE_SCRIPT_NAME,
  CLI_BIN_NAME,
  CLI_PACKAGE_NAME,
  getRockScriptCommand,
  pinRockScript,
  TEMPLATE_ROCK_SCRIPT_COMMAND,
  wireGeneratedPackageJson,
  compareVersions,
  computeUpgradePath,
  type ComputeUpgradePathOptions,
  ensureGitignoreLine,
  ensurePackageJsonWiring,
  getFallbackIntentionId,
  getIntentionOrderIssues,
  getUpgradeBranchName,
  isUnreleasedIntentionPath,
  type PromotedIntentionFile,
  promoteUnreleasedIntentions,
  type PromoteUnreleasedIntentionsOptions,
  type IntentionClassification,
  type IntentionFileInput,
  type IntentionMetadata,
  isIntentionClassification,
  type MigrationIntention,
  type PackageJsonShape,
  type ParsedIntentionMetadata,
  parseIntentionMetadataContent,
  parseReferencePathDeclarations,
  parseReferencePaths,
  PRODUCER_ARTIFACTS,
  type ReferencePathDeclaration,
  type ReferencePathMode,
  readOptionValue,
  type ReleaseInfo,
  resolveTargetVersion,
  type UpgradePath,
  versionGt,
  versionLte,
}
