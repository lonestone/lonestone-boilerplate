import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
const prompts = vi.hoisted(() => ({ select: vi.fn(async () => 'web-ssr') }))

vi.mock('./prompts', () => ({
  // Like Enquirer, turns the choices it gets into objects.
  Select: vi.fn(function Select(options: { choices: unknown[] }) {
    return {
      run: async () => {
        const answer = await prompts.select({ ...options, choices: [...options.choices] })
        options.choices.forEach((choice, index) => {
          options.choices[index] = { name: choice, value: choice }
        })
        return answer
      },
    }
  }),
  MultiSelect: vi.fn(),
  Input: vi.fn(),
  Confirm: vi.fn(),
}))

import {
  checkPreconditions,
  listReleaseTags,
  loadExtensionSource,
  parseExtensionArgs,
  resolveVariables,
} from './extension-command'
import { parseExtensionManifest, type ExtensionManifest } from './extension-manifest'
import {
  createExtensionRepository,
  createSampleProject,
  git,
  removeTemporaryPaths,
  SAMPLE_EXTENSION,
} from './extension.test-helpers'
import { trackingState } from './tracking-state'

afterEach(() => {
  removeTemporaryPaths()
  prompts.select.mockClear()
})

function sampleManifest(): ExtensionManifest {
  return parseExtensionManifest(
    JSON.parse(readFileSync(join(SAMPLE_EXTENSION, 'extension.json'), 'utf-8')),
    'sample',
  )
}

function flags(values: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(values))
}

describe('parseExtensionArgs', () => {
  it('reads positionals, values in both forms and boolean flags', () => {
    const parsed = parseExtensionArgs([
      'sample',
      '--app',
      'web-spa',
      '--app-id=com.acme.app',
      '--yes',
    ])

    expect(parsed.positionals).toEqual(['sample'])
    expect(parsed.values).toEqual(flags({ '--app': 'web-spa', '--app-id': 'com.acme.app' }))
    expect(parsed.booleans).toEqual(new Set(['--yes']))
  })

  it('refuses an option without a value', () => {
    expect(() => parseExtensionArgs(['sample', '--app', '--yes'])).toThrow('--app requires a value')
  })
})

describe('extension releases', () => {
  it('lists release tags newest first and ignores other tags', () => {
    const repository = createExtensionRepository([
      { tag: 'v1.0.0', min: '1.0.0' },
      { tag: 'v1.10.0', min: '1.0.0' },
      { tag: 'v1.2.0', min: '1.0.0' },
    ])
    git(repository, ['tag', 'latest'])

    expect(listReleaseTags(pathToFileURL(repository).href)).toEqual(['v1.10.0', 'v1.2.0', 'v1.0.0'])
  })

  it('picks the newest release compatible with the project', () => {
    const repository = createExtensionRepository([
      { tag: 'v1.0.0', min: '1.0.0' },
      { tag: 'v1.1.0', min: '1.4.0' },
      { tag: 'v2.0.0', min: '2.0.0' },
    ])

    const source = loadExtensionSource({
      name: 'sample',
      remote: pathToFileURL(repository).href,
      projectVersion: '1.4.0',
    })
    try {
      expect(source.version).toBe('1.1.0')
      expect(source.manifest.compatibility.boilerplate.min).toBe('1.4.0')
    } finally {
      source.cleanup()
    }
  })

  it('explains when no release supports the project', () => {
    const repository = createExtensionRepository([{ tag: 'v2.0.0', min: '2.0.0', below: '3.0.0' }])

    expect(() =>
      loadExtensionSource({
        name: 'sample',
        remote: pathToFileURL(repository).href,
        projectVersion: '1.4.0',
      }),
    ).toThrow(
      "No version of 'sample' supports boilerplate 1.4.0 (the latest, v2.0.0, needs >= 2.0.0 and < 3.0.0)",
    )
  })

  function twoReleases(): string {
    return pathToFileURL(
      createExtensionRepository([
        { tag: 'v1.0.0', min: '1.0.0' },
        { tag: 'v2.0.0', min: '2.0.0' },
      ]),
    ).href
  }

  it('installs the release named by --ref', () => {
    const remote = twoReleases()

    const source = loadExtensionSource({
      name: 'sample',
      remote,
      projectVersion: '1.4.0',
      ref: 'v1.0.0',
    })
    source.cleanup()

    expect(source.version).toBe('1.0.0')
  })

  it('refuses a --ref release that does not support the project', () => {
    const remote = twoReleases()

    const load = () =>
      loadExtensionSource({ name: 'sample', remote, projectVersion: '1.4.0', ref: 'v2.0.0' })

    expect(load).toThrow('sample v2.0.0 supports boilerplate >= 2.0.0, this project is on 1.4.0')
  })

  it('refuses a --ref that is not a release tag', () => {
    const load = () =>
      loadExtensionSource({
        name: 'sample',
        remote: twoReleases(),
        projectVersion: '1.4.0',
        ref: 'main',
      })

    expect(load).toThrow('--ref must be a release tag like v1.2.0')
  })

  it('uses a local directory as it is', () => {
    const source = loadExtensionSource({
      name: 'sample',
      remote: SAMPLE_EXTENSION,
      projectVersion: '1.4.0',
    })

    expect(source.version).toBe('local')
    expect(source.root).toBe(SAMPLE_EXTENSION)
  })
})

describe('resolveVariables', () => {
  it('takes flags, then defaults, and adds the app package variables', async () => {
    const root = createSampleProject({ apps: ['web-spa', 'web-ssr'] })

    const variables = await resolveVariables({
      manifest: sampleManifest(),
      projectRoot: root,
      flags: flags({ '--app': 'web-ssr', '--app-id': 'com.acme.app' }),
      interactive: false,
    })

    expect(variables).toEqual({
      projectName: 'acme',
      packageScope: '@acme',
      app: 'web-ssr',
      appPackage: '@acme/web-ssr',
      appId: 'com.acme.app',
      platforms: ['android', 'ios'],
    })
  })

  it('picks the only web app when there is one', async () => {
    const root = createSampleProject({ apps: ['web-spa'] })

    const variables = await resolveVariables({
      manifest: sampleManifest(),
      projectRoot: root,
      flags: flags({ '--app-id': 'com.acme.app' }),
      interactive: false,
    })

    expect(variables.app).toBe('web-spa')
  })

  it('asks which web app to wrap when there are several and no --app', async () => {
    const root = createSampleProject({ apps: ['web-spa', 'web-ssr'] })

    const variables = await resolveVariables({
      manifest: sampleManifest(),
      projectRoot: root,
      flags: flags({ '--app-id': 'com.acme.app', '--platforms': 'android' }),
      interactive: true,
    })

    expect(prompts.select).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'app', choices: ['web-spa', 'web-ssr'] }),
    )
    expect(variables.app).toBe('web-ssr')
  })

  it('does not ask for an option given as a flag', async () => {
    const root = createSampleProject({ apps: ['web-spa', 'web-ssr'] })

    await resolveVariables({
      manifest: sampleManifest(),
      projectRoot: root,
      flags: flags({ '--app': 'web-spa', '--app-id': 'com.acme.app', '--platforms': 'android' }),
      interactive: true,
    })

    expect(prompts.select).not.toHaveBeenCalled()
  })

  it('stops before asking when the project offers no value for a required choice', async () => {
    const root = createSampleProject({ apps: [] })

    await expect(
      resolveVariables({
        manifest: sampleManifest(),
        projectRoot: root,
        flags: flags({ '--app-id': 'com.acme.app' }),
        interactive: true,
      }),
    ).rejects.toThrow('--app has no possible value in this project: Web app to wrap')
    expect(prompts.select).not.toHaveBeenCalled()
  })

  it('needs a choice between several web apps when it cannot ask', async () => {
    const root = createSampleProject({ apps: ['web-spa', 'web-ssr'] })

    await expect(
      resolveVariables({
        manifest: sampleManifest(),
        projectRoot: root,
        flags: flags({ '--app-id': 'com.acme.app' }),
        interactive: false,
      }),
    ).rejects.toThrow('--app is required: one of web-spa, web-ssr')
  })

  it('names the expected format of a missing or invalid value', async () => {
    const root = createSampleProject()
    const manifest = sampleManifest()

    await expect(
      resolveVariables({
        manifest: manifest,
        projectRoot: root,
        flags: flags({}),
        interactive: false,
      }),
    ).rejects.toThrow('--app-id is required: reverse-domain id, lowercase, e.g. com.acme.app')
    await expect(
      resolveVariables({
        manifest: manifest,
        projectRoot: root,
        flags: flags({ '--app-id': 'Com.Acme' }),
        interactive: false,
      }),
    ).rejects.toThrow("--app-id: 'Com.Acme' is not valid, expected reverse-domain id")
    await expect(
      resolveVariables({
        manifest: manifest,
        projectRoot: root,
        flags: flags({ '--app-id': 'com.new.app' }),
        interactive: false,
      }),
    ).rejects.toThrow("--app-id: 'new' is a reserved word")
    await expect(
      resolveVariables({
        manifest: manifest,
        projectRoot: root,
        flags: flags({ '--app': 'web-ssr', '--app-id': 'com.acme.app' }),
        interactive: false,
      }),
    ).rejects.toThrow("--app: 'web-ssr' is not valid, expected one of web-spa")
    await expect(
      resolveVariables({
        manifest: manifest,
        projectRoot: root,
        flags: flags({ '--app-id': 'com.acme.app', '--platforms': 'android,windows' }),
        interactive: false,
      }),
    ).rejects.toThrow("--platforms: 'windows' is not valid")
  })
})

describe('checkPreconditions', () => {
  function check(root: string, variables: Record<string, string> = {}): string[] {
    const state = trackingState.read(root)
    if (!state) {
      throw new Error('missing state')
    }
    return checkPreconditions(sampleManifest().preconditions, {
      projectRoot: root,
      manifest: sampleManifest(),
      state,
      variables: {
        projectName: 'acme',
        packageScope: '@acme',
        app: 'web-spa',
        appPackage: '',
        ...variables,
      },
    })
  }

  it('passes on a clean project', () => {
    expect(check(createSampleProject())).toEqual([])
  })

  it('reports a dirty tree, an installed extension and missing paths', () => {
    const root = createSampleProject()
    writeFileSync(join(root, 'notes.txt'), 'wip\n')
    const state = trackingState.read(root)!
    trackingState.write(
      root,
      trackingState.addExtension(state, { name: 'sample', version: '1.0.0', options: {} }),
    )

    const issues = check(root, { app: 'web-ssr' })

    expect(issues).toEqual([
      expect.stringContaining('Commit or stash your changes first'),
      expect.stringMatching(/sample 1\.0\.0 is already installed .*Updating/),
      'apps/web-ssr not found',
    ])
    expect(issues[0]).toContain('notes.txt')
  })

  it('reports a project without any web app', () => {
    const root = createSampleProject({ apps: [] })

    expect(check(root)).toContain('This extension needs web-spa or web-ssr')
  })
})
