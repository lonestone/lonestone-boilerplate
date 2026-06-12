interface ReleaseInfo {
  version: string
  tag: string
  date: string
  hasMigrations: boolean
}

interface CheckpointInfo {
  id: string
  targetVersion: string
  minSourceVersion: string
  file: string
}

type IntentionClassification = 'no-migration' | 'informational' | 'migration' | 'breaking-manual'

interface MigrationIntention {
  id: string
  file: string
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
  checkpoints: CheckpointInfo[]
  intentionFiles: IntentionFileInput[]
}

interface UpgradePath {
  sourceVersion: string
  targetVersion: string
  checkpoints: string[]
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

  const selectedCheckpoints: string[] = []
  const earliestRelease = options.releases
    .filter(r => r.hasMigrations)
    .sort((a, b) => compareVersions(a.version, b.version))[0]

  if (earliestRelease) {
    for (const checkpoint of options.checkpoints) {
      if (versionLte(checkpoint.targetVersion, earliestRelease.version) && versionGt(checkpoint.targetVersion, options.sourceVersion)) {
        selectedCheckpoints.push(checkpoint.id)
      }
    }
  }

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
        domain,
        classification,
        metadataIssues: parsedMetadata.issues,
      })
    }
  }

  return {
    sourceVersion: options.sourceVersion,
    targetVersion: options.targetVersion,
    checkpoints: selectedCheckpoints,
    releases: releasesInRange.map(r => r.tag),
    intentions,
    sourceTag,
    targetTag,
    classificationCounts,
    skippedByDomain,
    alreadyResolvedCount,
  }
}

export {
  type CheckpointInfo,
  compareVersions,
  computeUpgradePath,
  type ComputeUpgradePathOptions,
  getFallbackIntentionId,
  getUpgradeBranchName,
  type IntentionClassification,
  type IntentionFileInput,
  type IntentionMetadata,
  isIntentionClassification,
  type MigrationIntention,
  type ParsedIntentionMetadata,
  parseIntentionMetadataContent,
  readOptionValue,
  type ReleaseInfo,
  type UpgradePath,
  versionGt,
  versionLte,
}
