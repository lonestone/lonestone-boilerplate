import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

interface AppliedIntention {
  id: string
  appliedAt: string
}

interface SkippedIntention {
  id: string
  reason: string
}

interface TrackingState {
  schemaVersion: number
  source: {
    repository: string
    remote?: string
    currentVersion: string
    commit?: string
  }
  trackedDomains: string[]
  intentions: {
    applied: AppliedIntention[]
    skipped: SkippedIntention[]
  }
}

interface CreateTrackingStateInput {
  currentVersion: string
  repository?: string
  remote?: string
  commit?: string
  trackedDomains?: string[]
}

type IntentionOutcome =
  | { status: 'applied'; id: string; appliedAt?: string }
  | { status: 'skipped'; id: string; reason: string }

const DEFAULT_TRACKED_DOMAINS = [
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
]
const KNOWN_TRACKED_DOMAINS = new Set(DEFAULT_TRACKED_DOMAINS)
const INTENTION_ID_PATTERN = /^v?\d+\.\d+\.\d+(?:\/[a-z0-9-]+)+$/

function canonicalizeIntentionId(id: string): string {
  return id.startsWith('v') ? id : `v${id}`
}

function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(Number)
  const bParts = b.split('.').map(Number)
  for (let index = 0; index < 3; index += 1) {
    if (aParts[index] !== bParts[index]) {
      return aParts[index] - bParts[index]
    }
  }
  return 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function getUnknownProperties(value: Record<string, unknown>, allowed: string[]): string[] {
  return Object.keys(value).filter((property) => !allowed.includes(property))
}

// Unknown properties and domains are version skew, not corruption: a consumer's
// vendored CLI is often older than the release that wrote the state. They are
// preserved as-is and reported through onWarning; only schemaVersion is the
// hard compatibility gate.
function normalize(
  value: unknown,
  context: string,
  onWarning: (message: string) => void = () => undefined,
): TrackingState {
  const invalid = (reason: string): never => {
    throw new Error(`Malformed ${context}: ${reason}`)
  }

  const state = isRecord(value) ? value : invalid('expected a JSON object')
  for (const property of getUnknownProperties(state, [
    'schemaVersion',
    'source',
    'trackedDomains',
    'intentions',
  ])) {
    onWarning(`tracking state contains unknown property: ${property}`)
  }
  if (state.schemaVersion !== 1) {
    invalid('schemaVersion must be 1')
  }
  const source = isRecord(state.source) ? state.source : invalid('source must be an object')
  for (const property of getUnknownProperties(source, [
    'repository',
    'remote',
    'currentVersion',
    'commit',
  ])) {
    onWarning(`source contains unknown property: ${property}`)
  }
  if (typeof source.repository !== 'string' || source.repository.length === 0) {
    invalid('source.repository must be a non-empty string')
  }
  if (source.remote !== undefined && (typeof source.remote !== 'string' || !source.remote)) {
    invalid('source.remote must be a non-empty string')
  }
  if (
    typeof source.remote === 'string' &&
    (/[\u0000-\u001f\u007f]/.test(source.remote) || source.remote.includes('```'))
  ) {
    invalid('source.remote cannot contain control characters or ```')
  }
  const currentVersion =
    typeof source.currentVersion === 'string'
      ? source.currentVersion
      : invalid('source.currentVersion must be a string')
  if (!/^v?\d+\.\d+\.\d+$/.test(currentVersion)) {
    invalid('source.currentVersion must match ^v?\\d+\\.\\d+\\.\\d+$')
  }
  if (
    source.commit !== undefined &&
    (typeof source.commit !== 'string' || !/^[a-f0-9]{7,40}$/.test(source.commit))
  ) {
    invalid('source.commit must match ^[a-f0-9]{7,40}$')
  }
  const domainValues = Array.isArray(state.trackedDomains)
    ? state.trackedDomains
    : invalid('trackedDomains must be an array')
  const trackedDomains = new Set<string>()
  for (const domain of domainValues) {
    if (typeof domain !== 'string') {
      invalid(`trackedDomains must contain strings, got: ${String(domain)}`)
    }
    if (trackedDomains.has(domain)) {
      invalid(`trackedDomains contains duplicate domain: ${domain}`)
    }
    if (!KNOWN_TRACKED_DOMAINS.has(domain)) {
      onWarning(`trackedDomains contains unknown domain: ${domain}`)
    }
    trackedDomains.add(domain)
  }
  const intentions = isRecord(state.intentions)
    ? state.intentions
    : invalid('intentions must be an object')
  for (const property of getUnknownProperties(intentions, ['applied', 'skipped'])) {
    onWarning(`intentions contains unknown property: ${property}`)
  }
  const applied = Array.isArray(intentions.applied)
    ? intentions.applied
    : invalid('intentions.applied and intentions.skipped must be arrays')
  const skipped = Array.isArray(intentions.skipped)
    ? intentions.skipped
    : invalid('intentions.applied and intentions.skipped must be arrays')
  const appliedIds = new Set<string>()
  const normalizedApplied: AppliedIntention[] = []
  for (const [index, outcome] of applied.entries()) {
    if (
      !isRecord(outcome) ||
      typeof outcome.id !== 'string' ||
      !INTENTION_ID_PATTERN.test(outcome.id)
    ) {
      invalid(`intentions.applied[${index}].id is invalid`)
    }
    for (const property of getUnknownProperties(outcome, ['id', 'appliedAt'])) {
      onWarning(`intentions.applied[${index}] contains unknown property: ${property}`)
    }
    if (!isValidDate(outcome.appliedAt)) {
      invalid(`intentions.applied[${index}].appliedAt must be a valid YYYY-MM-DD date`)
    }
    const id = canonicalizeIntentionId(outcome.id)
    if (appliedIds.has(id)) {
      invalid(`duplicate intention id: ${id}`)
    }
    appliedIds.add(id)
    normalizedApplied.push({ ...outcome, id, appliedAt: outcome.appliedAt })
  }
  const skippedIds = new Set<string>()
  const normalizedSkipped: SkippedIntention[] = []
  for (const [index, outcome] of skipped.entries()) {
    if (
      !isRecord(outcome) ||
      typeof outcome.id !== 'string' ||
      !INTENTION_ID_PATTERN.test(outcome.id)
    ) {
      invalid(`intentions.skipped[${index}].id is invalid`)
    }
    for (const property of getUnknownProperties(outcome, ['id', 'reason'])) {
      onWarning(`intentions.skipped[${index}] contains unknown property: ${property}`)
    }
    if (typeof outcome.reason !== 'string' || outcome.reason.length < 10) {
      invalid(`intentions.skipped[${index}].reason must be at least 10 characters`)
    }
    const id = canonicalizeIntentionId(outcome.id)
    if (skippedIds.has(id)) {
      invalid(`duplicate intention id: ${id}`)
    }
    if (appliedIds.has(id)) {
      invalid(`contradictory intention resolution: ${id}`)
    }
    skippedIds.add(id)
    normalizedSkipped.push({ ...outcome, id, reason: outcome.reason })
  }

  return {
    ...state,
    source: {
      ...source,
      currentVersion: currentVersion.replace(/^v(?=\d)/, ''),
    },
    intentions: {
      ...intentions,
      applied: normalizedApplied,
      skipped: normalizedSkipped,
    },
  } as TrackingState
}

function create(input: CreateTrackingStateInput): TrackingState {
  return normalize(
    {
      schemaVersion: 1,
      source: {
        repository: input.repository ?? 'lonestone/lonestone-boilerplate',
        remote: input.remote ?? 'https://github.com/lonestone/lonestone-boilerplate.git',
        currentVersion: input.currentVersion,
        ...(input.commit !== undefined ? { commit: input.commit } : {}),
      },
      trackedDomains: input.trackedDomains ?? [...DEFAULT_TRACKED_DOMAINS],
      intentions: { applied: [], skipped: [] },
    },
    'tracking state input',
  )
}

function read(projectPath: string): TrackingState | null {
  const filePath = join(projectPath, '.boilerstone', 'boilerplate.json')
  if (!existsSync(filePath)) {
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch (error) {
    throw new Error(
      `Invalid JSON in ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  return normalize(parsed, filePath, (message) =>
    console.warn(`  ⚠ ${filePath}: ${message} — kept for forward compatibility`),
  )
}

function record(state: TrackingState, outcome: IntentionOutcome): TrackingState {
  const currentState = normalize(state, 'tracking state')
  const canonicalId = canonicalizeIntentionId(outcome.id)
  const isAlreadyRecorded =
    currentState.intentions.applied.some((entry) => entry.id === canonicalId) ||
    currentState.intentions.skipped.some((entry) => entry.id === canonicalId)
  if (isAlreadyRecorded) {
    throw new Error(`Intention already recorded: ${canonicalId}`)
  }
  const intentions =
    outcome.status === 'applied'
      ? {
          ...currentState.intentions,
          applied: [
            ...currentState.intentions.applied,
            {
              id: canonicalId,
              appliedAt: outcome.appliedAt ?? new Date().toISOString().slice(0, 10),
            },
          ],
          skipped: [...currentState.intentions.skipped],
        }
      : {
          ...currentState.intentions,
          applied: [...currentState.intentions.applied],
          skipped: [
            ...currentState.intentions.skipped,
            { id: canonicalId, reason: outcome.reason.trim() },
          ],
        }

  return normalize({ ...currentState, intentions }, 'intention outcome')
}

function finish(state: TrackingState, targetVersion: string): TrackingState {
  const currentState = normalize(state, 'tracking state')
  const nextState = normalize(
    {
      ...currentState,
      source: { ...currentState.source, currentVersion: targetVersion },
    },
    'target tracking state',
  )
  if (compareVersions(nextState.source.currentVersion, currentState.source.currentVersion) < 0) {
    throw new Error(
      `Cannot finish downgrade from ${currentState.source.currentVersion} to ${nextState.source.currentVersion}`,
    )
  }
  return nextState
}

function write(projectPath: string, state: TrackingState): void {
  const filePath = join(projectPath, '.boilerstone', 'boilerplate.json')
  const canonicalState = normalize(state, filePath)
  mkdirSync(join(projectPath, '.boilerstone'), { recursive: true })
  const temporaryPath = `${filePath}.tmp-${process.pid}-${randomUUID()}`
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(canonicalState, null, 2)}\n`, 'utf-8')
    renameSync(temporaryPath, filePath)
  } finally {
    rmSync(temporaryPath, { force: true })
  }
}

const trackingState = { create, finish, read, record, write }

export { trackingState, type TrackingState }
