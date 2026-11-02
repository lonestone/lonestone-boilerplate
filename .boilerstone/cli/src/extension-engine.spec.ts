import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  appendEnvList,
  appendGitignore,
  applySteps,
  checkSteps,
  listSteps,
  mergeJson,
  StepFailedError,
  type EngineContext,
} from './extension-engine'
import {
  parseExtensionManifest,
  type ExtensionManifest,
  type TemplateVariables,
} from './extension-manifest'
import {
  createSampleProject,
  git,
  gitStatus,
  removeTemporaryPaths,
  SAMPLE_EXTENSION,
} from './extension.test-helpers'

afterEach(() => {
  removeTemporaryPaths()
  vi.restoreAllMocks()
})

const VARIABLES: TemplateVariables = {
  projectName: 'acme',
  packageScope: '@acme',
  app: 'web-spa',
  appPackage: '@acme/web-spa',
  appId: 'com.acme.app',
  platforms: ['android', 'ios'],
}

function sampleManifest(
  edit: (raw: { steps: unknown[] }) => void = () => undefined,
): ExtensionManifest {
  const raw = JSON.parse(readFileSync(join(SAMPLE_EXTENSION, 'extension.json'), 'utf-8')) as {
    steps: unknown[]
  }
  edit(raw)
  return parseExtensionManifest(raw, 'sample')
}

function context(
  projectRoot: string,
  manifest = sampleManifest(),
  variables: TemplateVariables = VARIABLES,
): EngineContext {
  return { projectRoot, extensionRoot: SAMPLE_EXTENSION, manifest, variables }
}

function read(root: string, path: string): string {
  return readFileSync(join(root, path), 'utf-8')
}

function commitAll(root: string): void {
  git(root, ['add', '-A'])
  git(root, ['commit', '--quiet', '-m', 'setup'])
}

function silent(): { log: (message: string) => void } {
  return { log: () => undefined }
}

describe('checkSteps', () => {
  it('finds nothing to report on a project shaped like the boilerplate', () => {
    const root = createSampleProject()

    expect(checkSteps(context(root))).toEqual([])
  })

  it('reports every problem in one pass and writes nothing', () => {
    const root = createSampleProject()
    writeFileSync(join(root, 'apps/web-spa/main.txt'), 'const b = 1\n// end\n// end\n')
    writeFileSync(
      join(root, 'apps/web-spa/package.json'),
      JSON.stringify({ name: '@acme/web-spa', scripts: { sample: 'something else' } }),
    )
    writeFileSync(join(root, 'apps/web-spa/com.acme.app.txt'), 'already here\n')
    rmSync(join(root, '.env.example'))
    commitAll(root)
    const manifest = sampleManifest((raw) => {
      raw.steps.push({ type: 'run', command: 'boilerstone-missing-command', args: [] })
    })

    const issues = checkSteps(context(root, manifest))

    expect(issues).toEqual([
      expect.stringContaining('apps/web-spa/com.acme.app.txt already exists'),
      expect.stringContaining('expected text "const a = 1" found 0 times'),
      expect.stringContaining('expected text "// end" found 2 times'),
      expect.stringContaining('expected text "// end" found 2 times'),
      expect.stringContaining('scripts.sample already has a different value'),
      expect.stringContaining('.env.example does not exist'),
      expect.stringContaining('boilerstone-missing-command is not installed'),
    ])
    expect(gitStatus(root)).toBe('')
  })

  it('checks a patch against the result of the previous patches of the same file', () => {
    const root = createSampleProject()
    const manifest = sampleManifest((raw) => {
      raw.steps.push({
        type: 'patch',
        file: 'apps/{{app}}/main.txt',
        find: 'const a = 2',
        action: 'replace',
        text: 'const a = 3',
      })
    })

    expect(checkSteps(context(root, manifest))).toEqual([])
  })

  it('only checks the sources of post steps', () => {
    const root = createSampleProject()
    const manifest = sampleManifest((raw) => {
      raw.steps.push({
        type: 'patch',
        file: 'apps/{{app}}/created-later.txt',
        action: 'prepend',
        text: 'x',
        phase: 'post',
      })
    })

    expect(checkSteps(context(root, manifest))).toEqual([])
  })
})

describe('applySteps', () => {
  it('applies every step', () => {
    const root = createSampleProject({ withLogo: true })
    writeFileSync(join(root, '.env'), 'TRUSTED_ORIGINS=http://localhost:5173,https://localhost\n')

    const result = applySteps(context(root), silent())

    expect(read(root, 'apps/web-spa/com.acme.app.txt')).toBe(
      'id=com.acme.app scope=@acme project=acme\n',
    )
    expect(read(root, 'apps/web-spa/config/sample.json')).toBe('{ "app": "@acme/web-spa" }\n')
    expect(read(root, 'apps/web-spa/android-only.txt')).toBe('android only\n')
    expect(read(root, 'apps/web-spa/logo.txt')).toBe('logo\n')
    expect(read(root, 'apps/web-spa/main.txt')).toBe(
      'import native\nconst a = 2\n// com.acme.app\n// end\n// after\n',
    )
    expect(JSON.parse(read(root, 'apps/web-spa/package.json'))).toEqual({
      name: '@acme/web-spa',
      private: true,
      scripts: { dev: 'vite', sample: 'echo com.acme.app' },
      keywords: ['sample'],
    })
    expect(read(root, '.env.example')).toBe(
      'TRUSTED_ORIGINS=http://localhost:5173,capacitor://localhost,https://localhost\n',
    )
    expect(read(root, '.env')).toBe(
      'TRUSTED_ORIGINS=http://localhost:5173,https://localhost,capacitor://localhost\n',
    )
    expect(read(root, '.gitignore')).toBe(
      'node_modules\n\n# Added by the sample extension\napps/web-spa/generated.txt\n',
    )
    expect(read(root, 'apps/web-spa/generated.txt')).toBe('ok')
    expect(result.changedFiles).toContain('apps/web-spa/main.txt')
  })

  it('honours list and pathExists conditions', () => {
    const root = createSampleProject()

    applySteps(context(root, sampleManifest(), { ...VARIABLES, platforms: ['ios'] }), silent())

    expect(existsSync(join(root, 'apps/web-spa/android-only.txt'))).toBe(false)
    expect(existsSync(join(root, 'apps/web-spa/logo.txt'))).toBe(false)
  })

  it('copies a file listed in requires only when its project path exists', () => {
    const root = createSampleProject()
    const manifest = sampleManifest((raw) => {
      raw.steps.splice(0, 1, {
        type: 'copy',
        from: 'templates/app',
        to: 'apps/{{app}}',
        render: true,
        requires: { 'config/sample.json': 'apps/{{app}}/needed.txt' },
      })
    })

    applySteps(context(root, manifest), silent())

    expect(existsSync(join(root, 'apps/web-spa/com.acme.app.txt'))).toBe(true)
    expect(existsSync(join(root, 'apps/web-spa/config/sample.json'))).toBe(false)
  })

  it('rolls back every change when a step fails', () => {
    const root = createSampleProject()
    writeFileSync(join(root, '.env'), 'TRUSTED_ORIGINS=http://localhost:5173\n')
    mkdirSync(join(root, 'apps/web-spa/overwritten'), { recursive: true })
    writeFileSync(join(root, 'apps/web-spa/overwritten/file.txt'), 'original\n')
    commitAll(root)
    const manifest = sampleManifest((raw) => {
      raw.steps.push(
        {
          type: 'copy',
          from: 'templates/android-only.txt',
          to: 'apps/{{app}}/overwritten/file.txt',
          ifExists: 'overwrite',
        },
        { type: 'run', command: 'node', args: ['-e', 'process.exit(3)'], failureHint: 'Try again' },
      )
    })

    expect(() => applySteps(context(root, manifest), silent())).toThrow(StepFailedError)

    expect(gitStatus(root)).toBe('')
    expect(read(root, '.env')).toBe('TRUSTED_ORIGINS=http://localhost:5173\n')
    expect(existsSync(join(root, 'apps/web-spa/generated.txt'))).toBe(false)
    expect(existsSync(join(root, 'apps/web-spa/config'))).toBe(false)
  })

  it('names the failing step and its hint', () => {
    const root = createSampleProject()
    const manifest = sampleManifest((raw) => {
      raw.steps.push({
        type: 'run',
        command: 'node',
        args: ['-e', 'process.exit(3)'],
        failureHint: 'Try again',
      })
    })

    try {
      applySteps(context(root, manifest), silent())
      expect.unreachable()
    } catch (error) {
      expect(String(error)).toContain('run node -e process.exit(3)')
      expect(String(error)).toContain('exit code 3')
      expect(String(error)).toContain('Try again')
    }
  })

  it('renders the template variables of env-list-append values', () => {
    const root = createSampleProject()
    const manifest = sampleManifest((raw) => {
      raw.steps.push({
        type: 'env-list-append',
        files: ['.env.example'],
        key: 'TRUSTED_ORIGINS',
        values: ['{{appId}}://localhost'],
      })
    })

    applySteps(context(root, manifest), silent())

    expect(read(root, '.env.example')).toContain(',com.acme.app://localhost\n')
  })

  it('refuses a path that leaves the project once the variables are rendered', () => {
    const root = createSampleProject()
    const manifest = sampleManifest((raw) => {
      raw.steps.splice(0, raw.steps.length, {
        type: 'copy',
        from: 'templates/android-only.txt',
        to: 'apps/{{app}}/android-only.txt',
      })
    })
    const outsideContext = context(root, manifest, { ...VARIABLES, app: '../../outside' })

    expect(checkSteps(outsideContext)).toEqual([
      expect.stringContaining('apps/../../outside/android-only.txt is not a relative path'),
    ])
    expect(() => applySteps(outsideContext, silent())).toThrow(StepFailedError)
    expect(existsSync(join(root, '../outside'))).toBe(false)
  })

  it('rolls back every change when recording the installation fails', () => {
    const root = createSampleProject()

    const apply = () =>
      applySteps(context(root), {
        ...silent(),
        gitRollback: true,
        record: () => {
          throw new Error('boilerplate.json is invalid')
        },
      })

    expect(apply).toThrow('Recording the installation failed: boilerplate.json is invalid')
    expect(gitStatus(root)).toBe('')
  })

  it('keeps the cause of the failure when the rollback itself fails', () => {
    const root = createSampleProject()
    rmSync(join(root, '.git'), { recursive: true, force: true })
    const manifest = sampleManifest((raw) => {
      raw.steps.push({ type: 'run', command: 'node', args: ['-e', 'process.exit(3)'] })
    })

    const apply = () => applySteps(context(root, manifest), { ...silent(), gitRollback: true })

    expect(apply).toThrow(/exit code 3[\s\S]*could not be fully restored/)
    expect(read(root, '.env.example')).toBe('TRUSTED_ORIGINS=http://localhost:5173\n')
  })
})

describe('listSteps', () => {
  it('lists a step that depends on a file a previous step copies', () => {
    const root = createSampleProject({ withLogo: true })
    const manifest = sampleManifest((raw) => {
      raw.steps.push({
        type: 'patch',
        file: 'apps/{{app}}/logo.txt',
        action: 'prepend',
        text: '# logo\n',
        when: { pathExists: 'apps/{{app}}/logo.txt' },
      })
    })

    expect(listSteps(context(root, manifest))).toContain('patch apps/web-spa/logo.txt')
  })
})

describe('appendEnvList', () => {
  it('updates the defined key, not the same text in a comment above it', () => {
    const content = '#TRUSTED_ORIGINS=a\nTRUSTED_ORIGINS=a\n'

    const result = appendEnvList(content, 'TRUSTED_ORIGINS', ['b'])

    expect(result).toBe('#TRUSTED_ORIGINS=a\nTRUSTED_ORIGINS=a,b\n')
  })

  it('appends only the missing values and keeps the quotes', () => {
    const content = 'A=1\nTRUSTED_ORIGINS="http://a,https://b"\nB=2\n'

    const result = appendEnvList(content, 'TRUSTED_ORIGINS', ['https://b', 'capacitor://localhost'])

    expect(result).toBe('A=1\nTRUSTED_ORIGINS="http://a,https://b,capacitor://localhost"\nB=2\n')
  })

  it('fills an empty value', () => {
    expect(appendEnvList('TRUSTED_ORIGINS=\n', 'TRUSTED_ORIGINS', ['x'])).toBe(
      'TRUSTED_ORIGINS=x\n',
    )
  })

  it('returns null when the key is not defined', () => {
    expect(appendEnvList('OTHER=1\n', 'TRUSTED_ORIGINS', ['x'])).toBeNull()
  })

  it('refuses a key defined twice', () => {
    const append = () => appendEnvList('KEY=a\nKEY=b\n', 'KEY', ['x'])

    expect(append).toThrow('defines KEY 2 times')
  })
})

describe('mergeJson', () => {
  it('adds missing keys, merges nested objects and appends missing array items', () => {
    const target = { a: 1, nested: { b: 2 }, list: ['x'] }

    const { result, conflicts } = mergeJson(target, { c: 3, nested: { d: 4 }, list: ['x', 'y'] })

    expect(result).toEqual({ a: 1, c: 3, nested: { b: 2, d: 4 }, list: ['x', 'y'] })
    expect(conflicts).toEqual([])
  })

  it('reports a different scalar as a conflict with its path', () => {
    const { conflicts } = mergeJson({ scripts: { dev: 'vite' } }, { scripts: { dev: 'other' } })

    expect(conflicts).toEqual(['scripts.dev'])
  })
})

describe('appendGitignore', () => {
  it('adds the missing lines under a header naming the extension', () => {
    const result = appendGitignore('node_modules\n', ['node_modules', 'dist/'], 'sample')

    expect(result).toBe('node_modules\n\n# Added by the sample extension\ndist/\n')
  })

  it('changes nothing when every line is there', () => {
    expect(appendGitignore('dist/\n', ['dist/'], 'sample')).toBe('dist/\n')
  })
})
