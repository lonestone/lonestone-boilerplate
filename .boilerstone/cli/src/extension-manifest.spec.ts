import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  getOptionFlag,
  isCompatible,
  parseExtensionManifest,
  renderTemplate,
} from './extension-manifest'
import { SAMPLE_EXTENSION } from './extension.test-helpers'

function sampleManifest(): Record<string, unknown> {
  return JSON.parse(readFileSync(join(SAMPLE_EXTENSION, 'extension.json'), 'utf-8')) as Record<
    string,
    unknown
  >
}

function withSteps(steps: unknown[]): Record<string, unknown> {
  return { ...sampleManifest(), steps }
}

describe('parseExtensionManifest', () => {
  it('accepts the sample extension', () => {
    const manifest = parseExtensionManifest(sampleManifest(), 'sample')

    expect(manifest.name).toBe('sample')
    expect(manifest.compatibility.boilerplate).toEqual({ min: '1.0.0', below: '2.0.0' })
    expect(manifest.options.map((option) => option.name)).toEqual(['app', 'appId', 'platforms'])
    expect(manifest.steps).toHaveLength(11)
  })

  it('refuses a schemaVersion other than 1', () => {
    expect(() => parseExtensionManifest({ ...sampleManifest(), schemaVersion: 2 }, 'x')).toThrow(
      'schemaVersion must be 1',
    )
  })

  it('refuses an unknown step type', () => {
    expect(() => parseExtensionManifest(withSteps([{ type: 'delete', file: 'a' }]), 'x')).toThrow(
      "steps[0]: unknown step type 'delete'",
    )
  })

  it('refuses an unknown template variable', () => {
    expect(() =>
      parseExtensionManifest(
        withSteps([{ type: 'gitignore', file: '.gitignore', lines: ['{{nope}}'] }]),
        'x',
      ),
    ).toThrow('unknown template variable {{nope}}')
  })

  it('refuses paths that leave the project or the extension', () => {
    expect(() =>
      parseExtensionManifest(
        withSteps([{ type: 'copy', from: 'templates/app', to: '../outside' }]),
        'x',
      ),
    ).toThrow("steps[0].to: path must be relative and must not contain '..'")
    expect(() =>
      parseExtensionManifest(
        withSteps([{ type: 'patch', file: '/etc/hosts', action: 'prepend', text: 'x' }]),
        'x',
      ),
    ).toThrow("steps[0].file: path must be relative and must not contain '..'")
  })

  it('needs exactly one of from and fromProject on a copy step', () => {
    expect(() => parseExtensionManifest(withSteps([{ type: 'copy', to: 'a' }]), 'x')).toThrow(
      'steps[0]: copy needs exactly one of from and fromProject',
    )
  })

  it('needs find on a patch step unless it prepends', () => {
    expect(() =>
      parseExtensionManifest(
        withSteps([{ type: 'patch', file: 'a', action: 'after', text: 'x' }]),
        'x',
      ),
    ).toThrow('steps[0].find is required')
  })

  it('lists every problem in one error', () => {
    try {
      parseExtensionManifest(
        { ...sampleManifest(), name: 'Bad Name', compatibility: { boilerplate: { min: 'x' } } },
        'x',
      )
      expect.unreachable()
    } catch (error) {
      expect(String(error)).toContain('name must be kebab-case')
      expect(String(error)).toContain('compatibility.boilerplate.min must be a version')
    }
  })
})

describe('getOptionFlag', () => {
  it('derives the kebab-case flag from the option name', () => {
    expect(getOptionFlag('appId')).toBe('--app-id')
    expect(getOptionFlag('app')).toBe('--app')
    expect(getOptionFlag('appDisplayName')).toBe('--app-display-name')
  })
})

describe('isCompatible', () => {
  it('accepts versions from min included to below excluded', () => {
    const range = { min: '1.4.0', below: '2.0.0' }
    expect(isCompatible(range, '1.3.9')).toBe(false)
    expect(isCompatible(range, '1.4.0')).toBe(true)
    expect(isCompatible(range, '1.12.0')).toBe(true)
    expect(isCompatible(range, '2.0.0')).toBe(false)
    expect(isCompatible({ min: '1.4.0' }, '9.0.0')).toBe(true)
  })
})

describe('renderTemplate', () => {
  it('replaces variables and joins lists with commas', () => {
    expect(
      renderTemplate('{{app}}:{{platforms}}', { app: 'web-spa', platforms: ['android', 'ios'] }),
    ).toBe('web-spa:android,ios')
  })

  it('fails on a variable without a value', () => {
    expect(() => renderTemplate('{{missing}}', {})).toThrow('no value for {{missing}}')
  })
})
