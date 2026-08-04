import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanupBoilerplateFiles } from '../../cli/setup'
import { trackingState } from './tracking-state'

const temporaryProjects: string[] = []

function writeTrackingState(value: unknown): string {
  const projectPath = mkdtempSync(join(tmpdir(), 'boilerstone-tracking-state-'))
  temporaryProjects.push(projectPath)
  mkdirSync(join(projectPath, '.boilerstone'))
  writeFileSync(
    join(projectPath, '.boilerstone', 'boilerplate.json'),
    typeof value === 'string' ? value : JSON.stringify(value),
  )
  return projectPath
}

afterEach(() => {
  for (const projectPath of temporaryProjects.splice(0)) {
    rmSync(projectPath, { recursive: true, force: true })
  }
})

describe('tracking state lifecycle', () => {
  it('creates a valid canonical tracking state', () => {
    const state = trackingState.create({ currentVersion: '1.2.3' })

    expect(state).toEqual({
      schemaVersion: 1,
      source: {
        repository: 'lonestone/lonestone-boilerplate',
        remote: 'https://github.com/lonestone/lonestone-boilerplate.git',
        currentVersion: '1.2.3',
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
      intentions: { applied: [], skipped: [] },
    })
  })

  it('normalizes a v-prefixed current version', () => {
    const state = trackingState.create({ currentVersion: '1.2.3' })
    const projectPath = writeTrackingState({
      ...state,
      source: { ...state.source, currentVersion: 'v1.2.3' },
    })

    expect(trackingState.read(projectPath)?.source.currentVersion).toBe('1.2.3')
  })

  it('canonicalizes legacy intention ids when reading existing state', () => {
    const projectPath = writeTrackingState({
      ...trackingState.create({ currentVersion: '1.2.3' }),
      intentions: {
        applied: [{ id: '1.2.3/applied', appliedAt: '2026-07-15' }],
        skipped: [{ id: '1.2.3/skipped', reason: 'Not used by this project' }],
      },
    })

    expect(trackingState.read(projectPath)?.intentions).toEqual({
      applied: [{ id: 'v1.2.3/applied', appliedAt: '2026-07-15' }],
      skipped: [{ id: 'v1.2.3/skipped', reason: 'Not used by this project' }],
    })
  })

  it('rejects an unsupported schema version', () => {
    const state = { ...trackingState.create({ currentVersion: '1.2.3' }), schemaVersion: 2 }
    const projectPath = writeTrackingState(state)

    expect(() => trackingState.read(projectPath)).toThrow('schemaVersion must be 1')
  })

  it.each([
    ['repository', { repository: '' }, 'source.repository must be a non-empty string'],
    ['remote', { remote: '' }, 'source.remote must be a non-empty string'],
    [
      'remote control character',
      { remote: 'https://example.com/repo.git\nmalicious' },
      'source.remote cannot contain control characters or ```',
    ],
    [
      'remote code fence',
      { remote: 'https://example.com/```/repo.git' },
      'source.remote cannot contain control characters or ```',
    ],
    ['commit', { commit: 'ABC123' }, 'source.commit must match ^[a-f0-9]{7,40}$'],
  ])('rejects an invalid source %s', (_name, sourceOverride, expectedMessage) => {
    const validState = trackingState.create({ currentVersion: '1.2.3' })
    const projectPath = writeTrackingState({
      ...validState,
      source: { ...validState.source, ...sourceOverride },
    })

    expect(() => trackingState.read(projectPath)).toThrow(expectedMessage)
  })

  it('rejects a duplicate tracked domain', () => {
    const projectPath = writeTrackingState({
      ...trackingState.create({ currentVersion: '1.2.3' }),
      trackedDomains: ['tooling', 'tooling'],
    })

    expect(() => trackingState.read(projectPath)).toThrow(
      'trackedDomains contains duplicate domain: tooling',
    )
  })

  it('keeps an unknown tracked domain and warns on read', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      const projectPath = writeTrackingState({
        ...trackingState.create({ currentVersion: '1.2.3' }),
        trackedDomains: ['tooling', 'payments'],
      })

      expect(trackingState.read(projectPath)?.trackedDomains).toEqual(['tooling', 'payments'])
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('trackedDomains contains unknown domain: payments'),
      )
    } finally {
      warnSpy.mockRestore()
    }
  })

  it.each([
    [
      { applied: [{ id: 'invalid', appliedAt: '2026-07-15' }], skipped: [] },
      'intentions.applied[0].id is invalid',
    ],
    [
      { applied: [], skipped: [{ id: 'invalid', reason: 'Long enough reason' }] },
      'intentions.skipped[0].id is invalid',
    ],
  ])('rejects a malformed intention outcome %#', (intentions, expectedMessage) => {
    const projectPath = writeTrackingState({
      ...trackingState.create({ currentVersion: '1.2.3' }),
      intentions,
    })

    expect(() => trackingState.read(projectPath)).toThrow(expectedMessage)
  })

  it('rejects an invalid applied date', () => {
    const projectPath = writeTrackingState({
      ...trackingState.create({ currentVersion: '1.2.3' }),
      intentions: {
        applied: [{ id: 'v1.2.3/example', appliedAt: '2026-02-30' }],
        skipped: [],
      },
    })

    expect(() => trackingState.read(projectPath)).toThrow(
      'intentions.applied[0].appliedAt must be a valid YYYY-MM-DD date',
    )
  })

  it('rejects a skip reason shorter than the schema minimum', () => {
    const projectPath = writeTrackingState({
      ...trackingState.create({ currentVersion: '1.2.3' }),
      intentions: {
        applied: [],
        skipped: [{ id: 'v1.2.3/example', reason: 'Too short' }],
      },
    })

    expect(() => trackingState.read(projectPath)).toThrow(
      'intentions.skipped[0].reason must be at least 10 characters',
    )
  })

  it.each([
    [
      {
        applied: [
          { id: 'v1.2.3/example', appliedAt: '2026-07-15' },
          { id: 'v1.2.3/example', appliedAt: '2026-07-16' },
        ],
        skipped: [],
      },
      'duplicate intention id: v1.2.3/example',
    ],
    [
      {
        applied: [],
        skipped: [
          { id: 'v1.2.3/example', reason: 'First valid reason' },
          { id: 'v1.2.3/example', reason: 'Second valid reason' },
        ],
      },
      'duplicate intention id: v1.2.3/example',
    ],
    [
      {
        applied: [{ id: 'v1.2.3/example', appliedAt: '2026-07-15' }],
        skipped: [{ id: 'v1.2.3/example', reason: 'A valid skip reason' }],
      },
      'contradictory intention resolution: v1.2.3/example',
    ],
    [
      {
        applied: [
          { id: '1.2.3/example', appliedAt: '2026-07-15' },
          { id: 'v1.2.3/example', appliedAt: '2026-07-16' },
        ],
        skipped: [],
      },
      'duplicate intention id: v1.2.3/example',
    ],
    [
      {
        applied: [{ id: '1.2.3/example', appliedAt: '2026-07-15' }],
        skipped: [{ id: 'v1.2.3/example', reason: 'A valid skip reason' }],
      },
      'contradictory intention resolution: v1.2.3/example',
    ],
  ])('rejects duplicate or contradictory intention outcomes %#', (intentions, expectedMessage) => {
    const projectPath = writeTrackingState({
      ...trackingState.create({ currentVersion: '1.2.3' }),
      intentions,
    })

    expect(() => trackingState.read(projectPath)).toThrow(expectedMessage)
  })

  it('records applied and skipped outcomes while preserving unrelated state', () => {
    const initialState = trackingState.create({
      currentVersion: '1.2.3',
      commit: 'abcdef1234567890',
      trackedDomains: ['tooling'],
    })

    const withApplied = trackingState.record(initialState, {
      status: 'applied',
      id: 'v1.3.0/applied-example',
      appliedAt: '2026-07-15',
    })
    const withSkipped = trackingState.record(withApplied, {
      status: 'skipped',
      id: 'v1.3.0/skipped-example',
      reason: 'Not used by this project',
    })

    expect(initialState.intentions.applied).toEqual([])
    expect(withSkipped).toEqual({
      ...initialState,
      intentions: {
        applied: [{ id: 'v1.3.0/applied-example', appliedAt: '2026-07-15' }],
        skipped: [{ id: 'v1.3.0/skipped-example', reason: 'Not used by this project' }],
      },
    })
  })

  it('refuses to record the same intention twice', () => {
    const state = trackingState.record(trackingState.create({ currentVersion: '1.2.3' }), {
      status: 'applied',
      id: 'v1.3.0/example',
      appliedAt: '2026-07-15',
    })

    expect(() =>
      trackingState.record(state, {
        status: 'skipped',
        id: 'v1.3.0/example',
        reason: 'No longer applicable',
      }),
    ).toThrow('Intention already recorded: v1.3.0/example')
  })

  it('canonicalizes ids when recording and detects their legacy equivalent', () => {
    const state = trackingState.record(trackingState.create({ currentVersion: '1.2.3' }), {
      status: 'applied',
      id: '1.3.0/example',
      appliedAt: '2026-07-15',
    })

    expect(state.intentions.applied[0]?.id).toBe('v1.3.0/example')
    expect(() =>
      trackingState.record(state, {
        status: 'skipped',
        id: 'v1.3.0/example',
        reason: 'No longer applicable',
      }),
    ).toThrow('Intention already recorded: v1.3.0/example')
  })

  it('finishes an upgrade canonically while preserving the rest of the state', () => {
    const state = trackingState.record(
      trackingState.create({
        currentVersion: '1.2.3',
        commit: 'abcdef1234567890',
        trackedDomains: ['api'],
      }),
      {
        status: 'applied',
        id: 'v1.3.0/example',
        appliedAt: '2026-07-15',
      },
    )

    expect(trackingState.finish(state, 'v1.3.0')).toEqual({
      ...state,
      source: { ...state.source, currentVersion: '1.3.0' },
    })
  })

  it('refuses to finish a downgrade without mutating the state', () => {
    const state = trackingState.create({ currentVersion: '1.2.3' })

    expect(() => trackingState.finish(state, '1.2.2')).toThrow(
      'Cannot finish downgrade from 1.2.3 to 1.2.2',
    )
    expect(state.source.currentVersion).toBe('1.2.3')
  })

  it('keeps invalid JSON errors contextualized with the state path', () => {
    const projectPath = writeTrackingState('{invalid')
    const statePath = join(projectPath, '.boilerstone', 'boilerplate.json')

    expect(() => trackingState.read(projectPath)).toThrow(`Invalid JSON in ${statePath}:`)
  })

  it('writes a validated canonical state and creates its directory', () => {
    const projectPath = mkdtempSync(join(tmpdir(), 'boilerstone-tracking-write-'))
    temporaryProjects.push(projectPath)
    const state = trackingState.create({ currentVersion: 'v1.2.3' })

    trackingState.write(projectPath, state)

    const content = readFileSync(join(projectPath, '.boilerstone', 'boilerplate.json'), 'utf-8')
    expect(content).toContain('"currentVersion": "1.2.3"')
    expect(content.endsWith('\n')).toBe(true)
    expect(
      readdirSync(join(projectPath, '.boilerstone')).filter((file) =>
        file.startsWith('boilerplate.json.tmp-'),
      ),
    ).toEqual([])
  })

  it('cleans the temporary state file when atomic replacement fails', () => {
    const projectPath = mkdtempSync(join(tmpdir(), 'boilerstone-tracking-write-failure-'))
    temporaryProjects.push(projectPath)
    mkdirSync(join(projectPath, '.boilerstone', 'boilerplate.json'), { recursive: true })

    expect(() =>
      trackingState.write(projectPath, trackingState.create({ currentVersion: '1.2.3' })),
    ).toThrow()
    expect(
      readdirSync(join(projectPath, '.boilerstone')).filter((file) =>
        file.startsWith('boilerplate.json.tmp-'),
      ),
    ).toEqual([])
  })

  it('rejects a malformed current version', () => {
    const validState = trackingState.create({ currentVersion: '1.2.3' })
    const projectPath = writeTrackingState({
      ...validState,
      source: { ...validState.source, currentVersion: '1.2' },
    })

    expect(() => trackingState.read(projectPath)).toThrow(
      'source.currentVersion must match ^v?\\d+\\.\\d+\\.\\d+$',
    )
  })

  it('preserves unknown properties from a newer release and warns on read', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      const validState = trackingState.record(
        trackingState.record(trackingState.create({ currentVersion: '1.2.3' }), {
          status: 'applied',
          id: 'v1.2.3/applied',
          appliedAt: '2026-07-15',
        }),
        {
          status: 'skipped',
          id: 'v1.2.3/skipped',
          reason: 'A valid skip reason',
        },
      )
      const projectPath = writeTrackingState({
        ...validState,
        pinnedModules: ['ai'],
        source: { ...validState.source, channel: 'stable' },
        intentions: {
          applied: [{ ...validState.intentions.applied[0], evidence: 'ci-run-42' }],
          skipped: [{ ...validState.intentions.skipped[0], reviewedBy: 'agent' }],
          deferred: [],
        },
      })

      const state = trackingState.read(projectPath)
      expect(state).toMatchObject({
        pinnedModules: ['ai'],
        source: { channel: 'stable' },
        intentions: {
          applied: [{ id: 'v1.2.3/applied', evidence: 'ci-run-42' }],
          skipped: [{ id: 'v1.2.3/skipped', reviewedBy: 'agent' }],
          deferred: [],
        },
      })
      for (const message of [
        'tracking state contains unknown property: pinnedModules',
        'source contains unknown property: channel',
        'intentions contains unknown property: deferred',
        'intentions.applied[0] contains unknown property: evidence',
        'intentions.skipped[0] contains unknown property: reviewedBy',
      ]) {
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(message))
      }

      // Round-trip: an older CLI recording an outcome must not strip newer fields
      if (!state) {
        throw new Error('expected tracking state to be readable')
      }
      trackingState.write(
        projectPath,
        trackingState.record(state, {
          status: 'applied',
          id: 'v1.2.3/later',
          appliedAt: '2026-07-16',
        }),
      )
      expect(
        JSON.parse(readFileSync(join(projectPath, '.boilerstone', 'boilerplate.json'), 'utf-8')),
      ).toMatchObject({
        pinnedModules: ['ai'],
        source: { channel: 'stable' },
        intentions: {
          applied: [{ evidence: 'ci-run-42' }, { id: 'v1.2.3/later' }],
          skipped: [{ reviewedBy: 'agent' }],
          deferred: [],
        },
      })
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('keeps setup and the consumer module tracking defaults synchronized', () => {
    const projectPath = mkdtempSync(join(tmpdir(), 'boilerstone-setup-defaults-'))
    temporaryProjects.push(projectPath)
    mkdirSync(join(projectPath, '.boilerstone'))
    writeFileSync(join(projectPath, 'package.json'), '{"version":"v1.2.3"}\n')
    const previousVersion = process.env.BOILERPLATE_SOURCE_VERSION
    const previousCommit = process.env.BOILERPLATE_SOURCE_COMMIT
    const previousRemote = process.env.BOILERPLATE_REPO
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    try {
      delete process.env.BOILERPLATE_SOURCE_VERSION
      delete process.env.BOILERPLATE_SOURCE_COMMIT
      delete process.env.BOILERPLATE_REPO
      cleanupBoilerplateFiles(projectPath)

      expect(
        JSON.parse(readFileSync(join(projectPath, '.boilerstone', 'boilerplate.json'), 'utf-8'))
          .source.currentVersion,
      ).toBe('1.2.3')
      expect(trackingState.read(projectPath)).toEqual(
        trackingState.create({ currentVersion: '1.2.3' }),
      )
    } finally {
      const restore = (name: string, value: string | undefined): void => {
        if (value === undefined) {
          delete process.env[name]
        } else {
          process.env[name] = value
        }
      }
      restore('BOILERPLATE_SOURCE_VERSION', previousVersion)
      restore('BOILERPLATE_SOURCE_COMMIT', previousCommit)
      restore('BOILERPLATE_REPO', previousRemote)
      logSpy.mockRestore()
    }
  })
})
