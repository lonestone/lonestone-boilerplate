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
  metadataIssues: string[]
}

interface IntentionMetadata {
  id?: string
  domain?: string
  classification?: IntentionClassification
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
  for (const line of match.groups.body.split(/\r?\n/)) {
    const [rawKey, ...rawValue] = line.split(':')
    const key = rawKey?.trim()
    const value = rawValue.join(':').trim()
    if (!key || !value) {
      continue
    }

    if (key === 'id') {
      metadata.id = value
    }
    else if (key === 'domain') {
      metadata.domain = value
    }
    else if (key === 'classification') {
      if (isIntentionClassification(value)) {
        metadata.classification = value
      }
      else {
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
  return `v${version}/${relativePath.replace(/\.md$/, '')}`
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
    'informational': 0,
    'migration': 0,
    'breaking-manual': 0,
  }
}

function computeUpgradePath(options: ComputeUpgradePathOptions): UpgradePath {
  const classificationCounts = createClassificationCounts()
  const skippedByDomain: Record<string, number> = {}
  let alreadyResolvedCount = 0

  const sourceTag = options.releases.find(r => r.version === options.sourceVersion)?.tag || `v${options.sourceVersion}`
  const targetTag = options.releases.find(r => r.version === options.targetVersion)?.tag || `v${options.targetVersion}`

  const releasesInRange = options.releases
    .filter(release => versionGt(release.version, options.sourceVersion) && versionLte(release.version, options.targetVersion))
    .sort((a, b) => compareVersions(a.version, b.version))

  const intentions: MigrationIntention[] = []

  for (const release of releasesInRange) {
    const releaseIntentionFiles = options.intentionFiles
      .filter(file => file.releaseVersion === release.version)
      .sort((a, b) => a.relativePath.localeCompare(b.relativePath))

    for (const file of releaseIntentionFiles) {
      const parsedMetadata = parseIntentionMetadataContent(file.content)
      const metadata = parsedMetadata.metadata
      const intentionId = metadata.id || getFallbackIntentionId(release.version, file.relativePath)
      const pathDomain = file.relativePath.includes('/') ? file.relativePath.split('/')[0] : undefined
      const domain = metadata.domain || pathDomain
      const classification = metadata.classification || 'migration'
      classificationCounts[classification] += 1

      if (options.appliedIntentions.includes(intentionId) || options.skippedIntentions.includes(intentionId)) {
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
        metadataIssues: parsedMetadata.issues,
      })
    }
  }

  return {
    sourceVersion: options.sourceVersion,
    targetVersion: options.targetVersion,
    releases: releasesInRange.map(r => r.tag),
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

  const scripts = { ...(next.scripts ?? {}) }
  if (!scripts[BOILERPLATE_SCRIPT_NAME]) {
    scripts[BOILERPLATE_SCRIPT_NAME] = BOILERPLATE_SCRIPT_COMMAND
    changes.push(`added "${BOILERPLATE_SCRIPT_NAME}" script`)
  }
  next.scripts = scripts

  const hasTsx = Boolean(next.dependencies?.tsx) || Boolean(next.devDependencies?.tsx)
  if (!hasTsx) {
    next.devDependencies = { ...(next.devDependencies ?? {}), tsx: tsxVersion }
    changes.push(`added "tsx" devDependency (${tsxVersion})`)
  }

  return { pkg: next, changes }
}

/**
 * Appends a line to .gitignore content if it is not already present.
 * Idempotent and newline-safe.
 */
/**
 * Resolves a requested target version, expanding the `latest` keyword to the
 * newest available release. Any other value is returned unchanged.
 */
function resolveTargetVersion(requested: string, releases: ReleaseInfo[]): string {
  if (requested !== 'latest') {
    return requested
  }
  if (releases.length === 0) {
    throw new Error('Cannot resolve "latest": no boilerplate releases are available (fetch release tags first)')
  }
  return [...releases].sort((a, b) => compareVersions(b.version, a.version))[0].version
}

function ensureGitignoreLine(content: string, line: string): { content: string, changed: boolean } {
  const exists = content.split(/\r?\n/).some(existing => existing.trim() === line)
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
  getFallbackIntentionId,
  getUpgradeBranchName,
  type IntentionClassification,
  type IntentionFileInput,
  type IntentionMetadata,
  isIntentionClassification,
  type MigrationIntention,
  type PackageJsonShape,
  type ParsedIntentionMetadata,
  parseIntentionMetadataContent,
  PRODUCER_ARTIFACTS,
  readOptionValue,
  type ReleaseInfo,
  resolveTargetVersion,
  type UpgradePath,
  versionGt,
  versionLte,
}
