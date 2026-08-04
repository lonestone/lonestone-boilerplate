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

const BOILERPLATE_SCRIPT_NAME = 'boilerplate'
const BOILERPLATE_SCRIPT_COMMAND = 'tsx ./.boilerstone/cli/boilerplate.ts'

// Producer-only artifacts that ship inside .boilerstone/ but are not maintained
// in a consumer project. Mirrors the .boilerstone/ subset of cli/setup.ts's
// cleanupBoilerplateFiles(). Paths are relative to the .boilerstone/ directory.
const PRODUCER_ARTIFACTS = [
  'migration-intentions',
  'boilerplate.example.json',
  'docs/pilot-rollout.md',
  'docs/ai-upgrades-implementation.md',
  'docs/release-maintainer-runbook.md',
  'cli/boilerplate-core.spec.ts',
  'cli/tracking-state.spec.ts',
  'cli/install.spec.ts',
  'cli/vitest.setup.ts',
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
 * Returns a copy of the root package.json wired for the boilerplate CLI:
 * adds the `boilerplate` script and a `tsx` devDependency when missing.
 * Idempotent — existing entries are never overwritten.
 */
function ensurePackageJsonWiring(pkg: PackageJsonShape, tsxVersion: string): PackageJsonWiring {
  const next: PackageJsonShape = { ...pkg }
  const changes: string[] = []

  const scripts = { ...next.scripts }
  if (!scripts[BOILERPLATE_SCRIPT_NAME]) {
    scripts[BOILERPLATE_SCRIPT_NAME] = BOILERPLATE_SCRIPT_COMMAND
    changes.push(`added "${BOILERPLATE_SCRIPT_NAME}" script`)
  }
  next.scripts = scripts

  const hasTsx = Boolean(next.dependencies?.tsx) || Boolean(next.devDependencies?.tsx)
  if (!hasTsx) {
    next.devDependencies = { ...next.devDependencies, tsx: tsxVersion }
    changes.push(`added "tsx" devDependency (${tsxVersion})`)
  }

  return { pkg: next, changes }
}

/**
 * Strips producer-only test tooling from the vendored `.boilerstone/package.json`
 * so consumer workspaces do not run or depend on the boilerplate's own Vitest suite.
 * Idempotent.
 */
function ensureConsumerBoilerstonePackageJson(pkg: PackageJsonShape): PackageJsonWiring {
  const next: PackageJsonShape = {
    ...pkg,
    scripts: { ...pkg.scripts },
    devDependencies: { ...pkg.devDependencies },
  }
  const changes: string[] = []

  if (next.scripts?.test) {
    const { test: _removed, ...scripts } = next.scripts
    next.scripts = scripts
    changes.push('removed "test" script')
  }

  if (next.devDependencies?.vitest) {
    const { vitest: _removed, ...devDependencies } = next.devDependencies
    next.devDependencies = devDependencies
    changes.push('removed "vitest" devDependency')
  }

  return { pkg: next, changes }
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

// Keep a Changelog entry headings, plus this repository's own Migration section.
const CHANGELOG_ENTRY_HEADINGS = [
  'Added',
  'Changed',
  'Deprecated',
  'Removed',
  'Fixed',
  'Security',
  'Migration',
]

const CHANGELOG_UNRELEASED_HEADER = /^## \[Unreleased\]\s*$/
const CHANGELOG_VERSION_HEADER = /^## \[(v?\d+\.\d+\.\d+)\]/

interface ChangelogSection {
  header: string
  lines: string[]
}

function parseChangelogSections(content: string): ChangelogSection[] {
  const sections: ChangelogSection[] = []
  let current: ChangelogSection | null = null
  for (const line of content.split('\n')) {
    if (line.startsWith('## ')) {
      current = { header: line, lines: [] }
      sections.push(current)
    } else if (current) {
      current.lines.push(line)
    }
  }
  return sections
}

/**
 * Structural rules for the root CHANGELOG.md (Keep a Changelog): a single
 * [Unreleased] section must lead the file to receive per-PR entries, entry
 * headings must come from the known set, and a version appears only once.
 */
function getChangelogIssues(content: string): string[] {
  const issues: string[] = []
  const sections = parseChangelogSections(content)
  const unreleasedCount = sections.filter((section) =>
    CHANGELOG_UNRELEASED_HEADER.test(section.header),
  ).length
  if (unreleasedCount === 0) {
    issues.push('missing "## [Unreleased]" section')
  } else if (unreleasedCount > 1) {
    issues.push('multiple "## [Unreleased]" sections')
  } else if (!CHANGELOG_UNRELEASED_HEADER.test(sections[0].header)) {
    issues.push('"## [Unreleased]" must be the first section')
  }

  const seenVersions = new Set<string>()
  for (const section of sections) {
    const version = section.header.match(CHANGELOG_VERSION_HEADER)?.[1]?.replace(/^v/, '')
    if (version) {
      if (seenVersions.has(version)) {
        issues.push(`duplicate version section: ${version}`)
      }
      seenVersions.add(version)
    }
    for (const line of section.lines) {
      const heading = line.match(/^### (.+?)\s*$/)?.[1]
      if (heading && !CHANGELOG_ENTRY_HEADINGS.includes(heading)) {
        issues.push(
          `unknown changelog heading "### ${heading}" — use one of: ${CHANGELOG_ENTRY_HEADINGS.join(', ')}`,
        )
      }
    }
  }
  return issues
}

function isChangelogUnreleasedEmpty(content: string): boolean {
  const section = parseChangelogSections(content).find((candidate) =>
    CHANGELOG_UNRELEASED_HEADER.test(candidate.header),
  )
  if (!section) {
    return true
  }
  return section.lines.every((line) => line.trim() === '' || line.startsWith('### '))
}

/**
 * Stamps the accumulated [Unreleased] section as a released version: renames
 * its header to `## [X.Y.Z] - date` and re-creates a fresh empty [Unreleased]
 * above it. Refuses malformed changelogs, an empty section (nothing to
 * release) and versions that already have a section.
 */
function stampChangelogRelease(content: string, version: string, date: string): string {
  const canonicalVersion = version.replace(/^v/, '')
  if (!/^\d+\.\d+\.\d+$/.test(canonicalVersion)) {
    throw new Error(`Invalid release version: ${version}`)
  }
  const issues = getChangelogIssues(content)
  if (issues.length > 0) {
    throw new Error(`Changelog is not releasable: ${issues.join('; ')}`)
  }
  if (isChangelogUnreleasedEmpty(content)) {
    throw new Error('The [Unreleased] section is empty — nothing to release')
  }
  const alreadyReleased = parseChangelogSections(content).some(
    (section) =>
      section.header.match(CHANGELOG_VERSION_HEADER)?.[1]?.replace(/^v/, '') === canonicalVersion,
  )
  if (alreadyReleased) {
    throw new Error(`Version ${canonicalVersion} already has a changelog section`)
  }

  const lines = content.split('\n')
  const headerIndex = lines.findIndex((line) => CHANGELOG_UNRELEASED_HEADER.test(line))
  lines.splice(headerIndex, 1, '## [Unreleased]', '', `## [${canonicalVersion}] - ${date}`)
  return lines.join('\n')
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

export {
  BOILERPLATE_SCRIPT_COMMAND,
  BOILERPLATE_SCRIPT_NAME,
  compareVersions,
  computeUpgradePath,
  type ComputeUpgradePathOptions,
  ensureGitignoreLine,
  ensurePackageJsonWiring,
  ensureConsumerBoilerstonePackageJson,
  getChangelogIssues,
  getFallbackIntentionId,
  getIntentionOrderIssues,
  isChangelogUnreleasedEmpty,
  getUpgradeBranchName,
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
  stampChangelogRelease,
  type UpgradePath,
  versionGt,
  versionLte,
}
