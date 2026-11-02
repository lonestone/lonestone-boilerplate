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

  it('reads plain and conditional next steps', () => {
    const manifest = parseExtensionManifest(
      {
        ...sampleManifest(),
        nextSteps: ['Commit', { text: 'Wire the API', when: { pathMissing: 'api/auth.ts' } }],
      },
      'x',
    )

    expect(manifest.nextSteps).toEqual([
      { text: 'Commit' },
      { text: 'Wire the API', when: { pathMissing: 'api/auth.ts' } },
    ])
  })

  it('refuses a next step without text or with an unknown condition', () => {
    expect(() =>
      parseExtensionManifest({ ...sampleManifest(), nextSteps: [{ when: {} }] }, 'x'),
    ).toThrow('nextSteps[0] must be a string, or an object with a text and a when')
    expect(() =>
      parseExtensionManifest(
        { ...sampleManifest(), nextSteps: [{ text: 'a', when: { nope: 'b' } }] },
        'x',
      ),
    ).toThrow("when: unknown option 'nope'")
    expect(() =>
      parseExtensionManifest(
        { ...sampleManifest(), nextSteps: [{ text: 'a', when: { pathMissing: '../a' } }] },
        'x',
      ),
    ).toThrow("nextSteps[0].when.pathMissing: path must be relative and must not contain '..'")
  })

  it('reads a path option and its helper', () => {
    const manifest = parseExtensionManifest(
      {
        ...sampleManifest(),
        options: [
          ...(sampleManifest().options as unknown[]),
          { name: 'icon', type: 'path', message: 'Icon', helper: 'cli/file-helper.mjs' },
        ],
      },
      'x',
    )

    expect(manifest.options.at(-1)).toEqual({
      name: 'icon',
      type: 'path',
      message: 'Icon',
      helper: 'cli/file-helper.mjs',
    })
  })

  it('refuses a helper outside the extension and an unknown option type', () => {
    const withOption = (option: Record<string, unknown>): Record<string, unknown> => ({
      ...sampleManifest(),
      options: [...(sampleManifest().options as unknown[]), option],
    })

    expect(() =>
      parseExtensionManifest(
        withOption({ name: 'icon', type: 'path', message: 'Icon', helper: '../helper.mjs' }),
        'x',
      ),
    ).toThrow("options[3].helper: path must be relative and must not contain '..'")
    expect(() =>
      parseExtensionManifest(withOption({ name: 'icon', type: 'file', message: 'Icon' }), 'x'),
    ).toThrow('options[3].type must be choice, string, list or path')
  })

  it('refuses an unknown step type', () => {
    expect(() => parseExtensionManifest(withSteps([{ type: 'delete', file: 'a' }]), 'x')).toThrow(
      "steps[0]: unknown step type 'delete'",
    )
  })

  it('refuses an unknown property at every level, so a typo cannot change the install', () => {
    const manifest = sampleManifest()
    const [option] = manifest.options as Record<string, unknown>[]
    const run = () =>
      parseExtensionManifest(
        {
          ...manifest,
          $schema: './extension.schema.json',
          comment: 'x',
          compatibility: { boilerplate: { min: '1.0.0', max: '2.0.0' } },
          options: [{ ...option, hint: 'x' }],
          preconditions: [{ type: 'clean-tree', strict: true }],
          nextSteps: [{ text: 'a', if: 'b' }],
          steps: [{ type: 'copy', from: 'templates/app', to: 'out', ifExist: 'skip' }],
        },
        'x',
      )

    expect(run).toThrow("manifest: unknown property 'comment'")
    expect(run).toThrow("compatibility.boilerplate: unknown property 'max'")
    expect(run).toThrow("options[0]: unknown property 'hint'")
    expect(run).toThrow("preconditions[0]: unknown property 'strict'")
    expect(run).toThrow("nextSteps[0]: unknown property 'if'")
    expect(run).toThrow("steps[0]: unknown property 'ifExist'")
    expect(run).not.toThrow('$schema')
  })

  it('refuses an unknown template variable', () => {
    expect(() =>
      parseExtensionManifest(
        withSteps([{ type: 'gitignore', file: '.gitignore', lines: ['{{nope}}'] }]),
        'x',
      ),
    ).toThrow('unknown template variable {{nope}}')
  })

  it('accepts the built-in variables, the absolute project root included', () => {
    const inputManifest = withSteps([
      {
        type: 'gitignore',
        file: '.gitignore',
        lines: ['{{projectName}} {{projectRoot}} {{packageScope}} {{app}} {{appPackage}}'],
      },
    ])

    expect(() => parseExtensionManifest(inputManifest, 'x')).not.toThrow()
  })

  it('reads the commit message, whose variables must be known', () => {
    const inputManifest = { ...sampleManifest(), commitMessage: 'feat({{app}}): add the sample' }

    expect(parseExtensionManifest(inputManifest, 'x').commitMessage).toBe(
      'feat({{app}}): add the sample',
    )
    expect(() =>
      parseExtensionManifest({ ...inputManifest, commitMessage: 'feat: {{nope}}' }, 'x'),
    ).toThrow('unknown template variable {{nope}}')
    expect(() => parseExtensionManifest({ ...inputManifest, commitMessage: 3 }, 'x')).toThrow(
      'commitMessage',
    )
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
