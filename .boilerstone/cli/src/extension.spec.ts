import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createExtensionRepository,
  createSampleProject,
  git,
  gitStatus,
  makeTemporaryDirectory,
  removeTemporaryPaths,
  SAMPLE_EXTENSION,
} from './extension.test-helpers'
import { trackingState } from './tracking-state'
import { isWindows } from './utils'

const cliBin = resolve(dirname(fileURLToPath(import.meta.url)), '../bin/boilerstone-cli.mjs')

afterEach(() => {
  removeTemporaryPaths()
})

function runCli(
  cwd: string,
  args: string[],
  extensionRepository = SAMPLE_EXTENSION,
): { status: number | null; stdout: string; output: string } {
  const result = spawnSync(process.execPath, [cliBin, ...args], {
    cwd,
    encoding: 'utf-8',
    // Own session: the CLI cannot open /dev/tty, so it never stops to ask.
    detached: !isWindows,
    env: { ...process.env, BOILERSTONE_EXTENSION_REPO: extensionRepository },
  })
  // eslint-disable-next-line no-control-regex
  const plain = (text: string): string => text.replace(/\u001B\[[0-9;]*m/g, '')
  return {
    status: result.status,
    stdout: result.stdout,
    output: plain(`${result.stdout}${result.stderr}`),
  }
}

// The sample registry entry does not exist in EXTENSIONS: the specs add
// `capacitor`, the only registered name, and point it at the sample extension
// renamed on the fly.
function sampleAsCapacitor(): string {
  const repository = createExtensionRepository([])
  const manifestPath = join(repository, 'extension.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as { name: string }
  manifest.name = 'capacitor'
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  return repository
}

describe('boilerstone-cli extension', () => {
  it('lists the extensions as JSON', () => {
    const root = createSampleProject()

    const result = runCli(root, ['extension', 'list', '--json'])

    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual([
      expect.objectContaining({ name: 'capacitor', installed: false }),
    ])
  })

  it('shows the installed version of an extension', () => {
    const root = createSampleProject()
    const state = trackingState.read(root)!
    trackingState.write(
      root,
      trackingState.addExtension(state, { name: 'capacitor', version: '1.2.0', options: {} }),
    )

    const result = runCli(root, ['extension', 'list'])

    expect(result.output).toContain('capacitor')
    expect(result.output).toContain('(installed 1.2.0)')
  })

  it('adds an extension from a working copy and records it', () => {
    const root = createSampleProject()

    const result = runCli(
      root,
      ['extension', 'add', 'capacitor', '--namespace', 'acme.shop', '--features', 'chat', '--yes'],
      sampleAsCapacitor(),
    )

    expect(result.status, result.output).toBe(0)
    expect(result.output).toContain('✓ capacitor local installed')
    expect(result.output).toContain('Run the web-spa app with id acme.shop')
    expect(existsSync(join(root, 'apps/web-spa/acme.shop.txt'))).toBe(true)
    expect(existsSync(join(root, 'apps/web-spa/search-only.txt'))).toBe(false)
    expect(trackingState.read(root)?.extensions).toEqual([
      {
        name: 'capacitor',
        version: 'local',
        options: { app: 'web-spa', namespace: 'acme.shop', features: ['chat'] },
        installedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      },
    ])
  })

  it.skipIf(isWindows)('formats the written files with the oxfmt of the project', () => {
    const root = createSampleProject()
    const bin = join(root, 'node_modules', '.bin')
    mkdirSync(bin, { recursive: true })
    writeFileSync(join(bin, 'oxfmt'), '#!/bin/sh\necho "$@" > oxfmt-args.txt\n', { mode: 0o755 })

    const result = runCli(
      root,
      ['extension', 'add', 'capacitor', '--namespace', 'acme.shop', '--yes'],
      sampleAsCapacitor(),
    )

    expect(result.status, result.output).toBe(0)
    const formatted = readFileSync(join(root, 'oxfmt-args.txt'), 'utf-8').trim().split(' ')
    expect(formatted).toEqual(
      expect.arrayContaining([
        '--no-error-on-unmatched-pattern',
        'apps/web-spa/package.json',
        'apps/web-spa/main.txt',
        '.boilerstone/boilerplate.json',
      ]),
    )
  })

  it('adds the newest compatible release of a git remote', () => {
    const root = createSampleProject({ version: '1.4.0' })
    const repository = sampleAsCapacitor()
    git(repository, ['add', '-A'])
    git(repository, ['commit', '--quiet', '-m', 'v1'])
    git(repository, ['tag', 'v1.0.0'])

    const result = runCli(
      root,
      ['extension', 'add', 'capacitor', '--namespace', 'acme.shop', '--yes'],
      pathToFileURL(repository).href,
    )

    expect(result.status, result.output).toBe(0)
    expect(result.output).toContain('✓ capacitor 1.0.0 installed')
    expect(trackingState.read(root)?.extensions?.[0].version).toBe('1.0.0')
  })

  it('refuses an unknown extension', () => {
    const result = runCli(createSampleProject(), ['extension', 'add', 'nope', '--yes'])

    expect(result.status).toBe(1)
    expect(result.output).toContain("Unknown extension 'nope'. Available: capacitor")
  })

  it('refuses to run outside a project', () => {
    const result = runCli(makeTemporaryDirectory('boilerstone-no-project-'), [
      'extension',
      'add',
      'capacitor',
      '--yes',
    ])

    expect(result.status).toBe(1)
    expect(result.output).toContain('No .boilerstone/boilerplate.json found')
  })

  it('changes nothing on a dirty tree', () => {
    const root = createSampleProject()
    writeFileSync(join(root, 'notes.txt'), 'wip\n')

    const result = runCli(
      root,
      ['extension', 'add', 'capacitor', '--namespace', 'acme.shop', '--yes'],
      sampleAsCapacitor(),
    )

    expect(result.status).toBe(1)
    expect(result.output).toContain('Commit or stash your changes first')
    expect(result.output).toContain(
      'Manual steps and troubleshooting: https://example.com/sample/online',
    )
    expect(gitStatus(root)).toBe('?? notes.txt')
  })

  it('refuses a second installation', () => {
    const root = createSampleProject()
    const extension = sampleAsCapacitor()
    const args = ['extension', 'add', 'capacitor', '--namespace', 'acme.shop', '--yes']
    expect(runCli(root, args, extension).status).toBe(0)
    git(root, ['add', '-A'])
    git(root, ['commit', '--quiet', '-m', 'added'])

    const second = runCli(root, args, extension)

    expect(second.status).toBe(1)
    expect(second.output).toContain('capacitor local is already installed')
  })

  it('stops on a missing required option when it cannot ask', () => {
    const result = runCli(
      createSampleProject(),
      ['extension', 'add', 'capacitor', '--yes'],
      sampleAsCapacitor(),
    )

    expect(result.status).toBe(1)
    expect(result.output).toContain('--namespace is required: dotted namespace')
  })

  it('refuses an option the extension does not declare', () => {
    const result = runCli(
      createSampleProject(),
      ['extension', 'add', 'capacitor', '--namespace', 'acme.shop', '--color', 'red', '--yes'],
      sampleAsCapacitor(),
    )

    expect(result.status).toBe(1)
    expect(result.output).toContain(
      'Unknown option --color. Options of capacitor: --app, --namespace, --features',
    )
  })
})
