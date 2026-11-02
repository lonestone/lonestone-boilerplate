import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
const prompts = vi.hoisted(() => ({
  select: vi.fn(async () => 'web-ssr'),
  input: vi.fn(async (): Promise<string> => ''),
}))

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
  Input: vi.fn(function Input(options: unknown) {
    return { run: () => prompts.input(options) }
  }),
  Confirm: vi.fn(),
}))

import {
  checkPreconditions,
  commitInstallation,
  commitInstallIfAsked,
  describeDocs,
  listNextSteps,
  listReleaseTags,
  loadExtensionSource,
  parseExtensionArgs,
  printInstallChanges,
  resolvePathAnswer,
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
  prompts.input.mockReset()
  vi.restoreAllMocks()
})

function sampleRaw(): Record<string, unknown> {
  return JSON.parse(readFileSync(join(SAMPLE_EXTENSION, 'extension.json'), 'utf-8')) as Record<
    string,
    unknown
  >
}

function sampleManifest(): ExtensionManifest {
  return parseExtensionManifest(sampleRaw(), 'sample')
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
      '--namespace=acme.shop',
      '--yes',
    ])

    expect(parsed.positionals).toEqual(['sample'])
    expect(parsed.values).toEqual(flags({ '--app': 'web-spa', '--namespace': 'acme.shop' }))
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
      flags: flags({ '--app': 'web-ssr', '--namespace': 'acme.shop' }),
      interactive: false,
    })

    expect(variables).toEqual({
      projectName: 'acme',
      projectRoot: root,
      packageScope: '@acme',
      app: 'web-ssr',
      appPackage: '@acme/web-ssr',
      namespace: 'acme.shop',
      features: ['search', 'chat'],
    })
  })

  it('picks the only web app when there is one', async () => {
    const root = createSampleProject({ apps: ['web-spa'] })

    const variables = await resolveVariables({
      manifest: sampleManifest(),
      projectRoot: root,
      flags: flags({ '--namespace': 'acme.shop' }),
      interactive: false,
    })

    expect(variables.app).toBe('web-spa')
  })

  it('asks which web app to wrap when there are several and no --app', async () => {
    const root = createSampleProject({ apps: ['web-spa', 'web-ssr'] })

    const variables = await resolveVariables({
      manifest: sampleManifest(),
      projectRoot: root,
      flags: flags({ '--namespace': 'acme.shop', '--features': 'search' }),
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
      flags: flags({ '--app': 'web-spa', '--namespace': 'acme.shop', '--features': 'search' }),
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
        flags: flags({ '--namespace': 'acme.shop' }),
        interactive: true,
      }),
    ).rejects.toThrow('--app has no possible value in this project: Web app to extend')
    expect(prompts.select).not.toHaveBeenCalled()
  })

  it('needs a choice between several web apps when it cannot ask', async () => {
    const root = createSampleProject({ apps: ['web-spa', 'web-ssr'] })

    await expect(
      resolveVariables({
        manifest: sampleManifest(),
        projectRoot: root,
        flags: flags({ '--namespace': 'acme.shop' }),
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
    ).rejects.toThrow('--namespace is required: dotted namespace, lowercase, e.g. acme.shop')
    await expect(
      resolveVariables({
        manifest: manifest,
        projectRoot: root,
        flags: flags({ '--namespace': 'Acme.Shop' }),
        interactive: false,
      }),
    ).rejects.toThrow("--namespace: 'Acme.Shop' is not valid, expected dotted namespace")
    await expect(
      resolveVariables({
        manifest: manifest,
        projectRoot: root,
        flags: flags({ '--namespace': 'com.new.app' }),
        interactive: false,
      }),
    ).rejects.toThrow("--namespace: 'new' is a reserved word")
    await expect(
      resolveVariables({
        manifest: manifest,
        projectRoot: root,
        flags: flags({ '--app': 'web-ssr', '--namespace': 'acme.shop' }),
        interactive: false,
      }),
    ).rejects.toThrow("--app: 'web-ssr' is not valid, expected one of web-spa")
    await expect(
      resolveVariables({
        manifest: manifest,
        projectRoot: root,
        flags: flags({ '--namespace': 'acme.shop', '--features': 'search,windows' }),
        interactive: false,
      }),
    ).rejects.toThrow("--features: 'windows' is not valid")
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

describe('listNextSteps', () => {
  function nextStepsContext(root: string, raw: Record<string, unknown>) {
    const manifest = parseExtensionManifest({ ...sampleRaw(), ...raw }, 'sample')
    return {
      projectRoot: root,
      extensionRoot: SAMPLE_EXTENSION,
      manifest,
      variables: { projectName: 'acme', app: 'web-spa', appPackage: '@acme/web-spa' },
    }
  }

  it('keeps the steps whose condition holds and numbers them without gaps', () => {
    const root = createSampleProject()

    const steps = listNextSteps(
      nextStepsContext(root, {
        nextSteps: [
          'Commit',
          { text: 'Wire {{app}} by hand', when: { pathMissing: 'apps/{{app}}/auth.ts' } },
          { text: 'Never shown', when: { pathMissing: 'apps/{{app}}/main.txt' } },
          'Run {{appPackage}}',
        ],
      }),
    )

    expect(steps).toEqual(['1. Commit', '2. Wire web-spa by hand', '3. Run @acme/web-spa'])
  })

  it('points at the online docs when the docs page was not copied into the project', () => {
    const root = createSampleProject()
    const raw = { docs: 'apps/docs/{{app}}.mdx', docsUrl: 'https://example.com/docs' }

    expect(describeDocs(nextStepsContext(root, raw))).toBe('https://example.com/docs')
    mkdirSync(join(root, 'apps/docs'), { recursive: true })
    writeFileSync(join(root, 'apps/docs/web-spa.mdx'), '# Docs\n')
    expect(describeDocs(nextStepsContext(root, raw))).toBe('apps/docs/web-spa.mdx')
  })
})

describe('resolveVariables with a path option', () => {
  function pathManifest(option: Record<string, unknown> = {}): ExtensionManifest {
    return parseExtensionManifest(
      {
        ...sampleRaw(),
        options: [
          ...(sampleRaw().options as unknown[]),
          {
            name: 'image',
            type: 'path',
            message: 'Image file',
            helper: 'cli/file-helper.mjs',
            ...option,
          },
        ],
      },
      'sample',
    )
  }

  function resolveImage(root: string, image: Record<string, string>, interactive = false) {
    return resolveVariables({
      helperTimeoutMs: 2000,
      manifest: pathManifest(),
      projectRoot: root,
      extensionRoot: SAMPLE_EXTENSION,
      flags: flags({
        '--app': 'web-spa',
        '--namespace': 'acme.shop',
        '--features': 'search',
        ...image,
      }),
      interactive,
      cwd: root,
    })
  }

  it('resolves a relative or ~/ answer to an absolute path', async () => {
    const root = createSampleProject()
    writeFileSync(join(root, 'good.txt'), 'good\n')

    const variables = await resolveImage(root, { '--image': 'good.txt' })

    expect(variables.image).toBe(join(root, 'good.txt'))
    expect(resolvePathAnswer('~/image.png', root)).toBe(join(homedir(), 'image.png'))
  })

  it('refuses a missing file, a folder and an answer the helper refuses', async () => {
    const root = createSampleProject()
    writeFileSync(join(root, 'bad.txt'), 'bad\n')
    writeFileSync(join(root, 'crash.txt'), 'crash\n')

    await expect(resolveImage(root, { '--image': 'nope.txt' })).rejects.toThrow(
      `${join(root, 'nope.txt')}: file not found`,
    )
    await expect(resolveImage(root, { '--image': 'apps' })).rejects.toThrow(
      `${join(root, 'apps')}: is a folder, not a file`,
    )
    await expect(resolveImage(root, { '--image': 'bad.txt' })).rejects.toThrow(
      `${join(root, 'bad.txt')}: not a good file`,
    )
    await expect(resolveImage(root, { '--image': 'crash.txt' })).rejects.toThrow(
      'cli/file-helper.mjs could not check',
    )
  })

  it('takes a path with spaces as typed', async () => {
    const root = createSampleProject()
    mkdirSync(join(root, 'my design'))
    writeFileSync(join(root, 'my design/app image.txt'), 'good\n')

    const variables = await resolveImage(root, { '--image': 'my design/app image.txt' })

    expect(variables.image).toBe(join(root, 'my design/app image.txt'))
  })

  it('refuses an answer the helper takes too long to check, naming the helper', async () => {
    const root = createSampleProject()
    writeFileSync(join(root, 'hang.txt'), 'hang\n')

    await expect(resolveImage(root, { '--image': 'hang.txt' })).rejects.toThrow(
      `${join(root, 'hang.txt')}: cli/file-helper.mjs could not check it`,
    )
  })

  it('asks without a default when the helper cannot suggest one', async () => {
    const root = createSampleProject()
    mkdirSync(join(root, 'assets'))
    writeFileSync(join(root, 'assets/image.txt'), 'good\n')
    writeFileSync(join(root, 'assets/crash-suggest'), '')
    prompts.input.mockResolvedValueOnce('')

    const variables = await resolveImage(root, {}, true)

    expect(prompts.input).toHaveBeenCalledWith(
      expect.not.objectContaining({ initial: expect.anything() }),
    )
    expect(variables.image).toBe('')
  })

  it('leaves an empty answer empty, without calling the helper', async () => {
    const root = createSampleProject()

    const variables = await resolveImage(root, { '--image': '' })

    expect(variables.image).toBe('')
  })

  it('pre-fills the question with the suggestion and asks again after a refusal', async () => {
    const root = createSampleProject()
    mkdirSync(join(root, 'assets'))
    writeFileSync(join(root, 'assets/image.txt'), 'good\n')
    writeFileSync(join(root, 'bad.txt'), 'bad\n')
    prompts.input.mockResolvedValueOnce('bad.txt').mockResolvedValueOnce('assets/image.txt')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const variables = await resolveImage(root, {}, true)

    expect(prompts.input).toHaveBeenCalledTimes(2)
    expect(prompts.input).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ initial: join('assets', 'image.txt') }),
    )
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('not a good file'))
    expect(variables.image).toBe(join(root, 'assets/image.txt'))
  })

  it('takes the suggestion without a terminal', async () => {
    const root = createSampleProject()
    mkdirSync(join(root, 'assets'))
    writeFileSync(join(root, 'assets/image.txt'), 'good\n')

    const variables = await resolveImage(root, {})

    expect(variables.image).toBe(join(root, 'assets/image.txt'))
  })
})

describe('resolveVariables with a helper on a text option', () => {
  it('takes the suggestion as it is, not as a path, from any folder', async () => {
    const root = createSampleProject()
    mkdirSync(join(root, 'assets'))
    writeFileSync(join(root, 'assets/name.txt'), 'Step up\n')
    const inputManifest = parseExtensionManifest(
      {
        ...sampleRaw(),
        options: [
          ...(sampleRaw().options as unknown[]),
          { name: 'label', type: 'string', message: 'Label', helper: 'cli/name-helper.mjs' },
        ],
      },
      'sample',
    )

    const actualVariables = await resolveVariables({
      helperTimeoutMs: 2000,
      manifest: inputManifest,
      projectRoot: root,
      extensionRoot: SAMPLE_EXTENSION,
      flags: flags({ '--app': 'web-spa', '--namespace': 'acme.shop', '--features': 'search' }),
      interactive: false,
      cwd: join(root, 'assets'),
    })

    expect(actualVariables.label).toBe('Step up')
  })
})

describe('commitInstallation', () => {
  /** A committed sample project with uncommitted changes, and a git identity as on a developer machine. */
  function createChangedProject(): string {
    const inputRoot = createSampleProject()
    writeFileSync(join(inputRoot, 'apps/web-spa/sample-file.txt'), 'sample\n')
    writeFileSync(join(inputRoot, '.env.example'), 'TRUSTED_ORIGINS=sample://localhost\n')
    vi.stubEnv('GIT_AUTHOR_NAME', 'Dev')
    vi.stubEnv('GIT_AUTHOR_EMAIL', 'dev@example.com')
    vi.stubEnv('GIT_COMMITTER_NAME', 'Dev')
    vi.stubEnv('GIT_COMMITTER_EMAIL', 'dev@example.com')
    vi.stubEnv('GIT_CONFIG_COUNT', '1')
    vi.stubEnv('GIT_CONFIG_KEY_0', 'commit.gpgsign')
    vi.stubEnv('GIT_CONFIG_VALUE_0', 'false')
    return inputRoot
  }

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('commits every change of the installation, new files included', () => {
    const inputRoot = createChangedProject()

    const actualResult = commitInstallation(inputRoot, 'feat(frontend): add the sample extension')

    expect(actualResult).toEqual({
      committed: true,
      message: 'feat(frontend): add the sample extension',
    })
    expect(git(inputRoot, ['log', '-1', '--format=%s']).trim()).toBe(
      'feat(frontend): add the sample extension',
    )
    expect(git(inputRoot, ['status', '--porcelain'])).toBe('')
  })

  it('commits only when the manifest gives a message and requires a clean tree', () => {
    const inputRoot = createChangedProject()
    const inputVariables = { projectName: 'acme', projectRoot: inputRoot, app: 'web-spa' }
    const inputManifestWithoutMessage = sampleManifest()
    const inputManifestWithoutCleanTree: ExtensionManifest = {
      ...inputManifestWithoutMessage,
      commitMessage: 'feat({{app}}): add the sample',
      preconditions: inputManifestWithoutMessage.preconditions.filter(
        (precondition) => precondition.type !== 'clean-tree',
      ),
    }

    expect(
      commitInstallIfAsked({
        manifest: inputManifestWithoutMessage,
        projectRoot: inputRoot,
        variables: inputVariables,
      }),
    ).toBeUndefined()
    expect(
      commitInstallIfAsked({
        manifest: inputManifestWithoutCleanTree,
        projectRoot: inputRoot,
        variables: inputVariables,
      }),
    ).toBeUndefined()
    expect(git(inputRoot, ['log', '-1', '--format=%s']).trim()).toBe('init')

    const actualResult = commitInstallIfAsked({
      manifest: { ...inputManifestWithoutMessage, commitMessage: 'feat({{app}}): add the sample' },
      projectRoot: inputRoot,
      variables: inputVariables,
    })

    expect(actualResult).toEqual({ committed: true, message: 'feat(web-spa): add the sample' })
  })

  it('shows the commit, or how to commit by hand when git refused it', () => {
    const inputRoot = createChangedProject()
    const mockLog = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    printInstallChanges(inputRoot, {
      committed: false,
      message: 'feat(frontend): add the sample extension',
      output: 'subject may not be empty',
    })
    const actualRefused = mockLog.mock.calls.flat().join('\n')
    commitInstallation(inputRoot, 'feat(frontend): add the sample extension')
    mockLog.mockClear()
    printInstallChanges(inputRoot, {
      committed: true,
      message: 'feat(frontend): add the sample extension',
    })
    const actualCommitted = mockLog.mock.calls.flat().join('\n')

    expect(actualRefused).toContain('git refused the commit')
    expect(actualRefused).toContain('subject may not be empty')
    expect(actualRefused).toContain(
      'Commit by hand: git add -A && git commit -m "feat(frontend): add the sample extension"',
    )
    expect(actualRefused).toContain('apps/web-spa/sample-file.txt')
    expect(actualCommitted).toContain('Committed:')
    expect(actualCommitted).toContain('feat(frontend): add the sample extension')
    expect(actualCommitted).toContain('apps/web-spa/sample-file.txt')
  })

  it('leaves the changes staged and returns the output when a hook refuses the commit', () => {
    const inputRoot = createChangedProject()
    const mockHook = join(inputRoot, '.git/hooks/commit-msg')
    writeFileSync(mockHook, '#!/bin/sh\necho "subject must not be sentence-case" >&2\nexit 1\n')
    chmodSync(mockHook, 0o755)

    const actualResult = commitInstallation(inputRoot, 'Add the sample extension')

    expect(actualResult).toEqual({
      committed: false,
      message: 'Add the sample extension',
      output: expect.stringContaining('subject must not be sentence-case'),
    })
    expect(git(inputRoot, ['log', '-1', '--format=%s']).trim()).toBe('init')
    expect(git(inputRoot, ['status', '--porcelain'])).toContain('apps/web-spa/sample-file.txt')
  })
})
