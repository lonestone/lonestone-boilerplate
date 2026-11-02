/**
 * `extension list` and `extension add <name>`.
 *
 * `add` fetches the newest release of the extension that supports the
 * project's boilerplate version, resolves its options (flags, then prompts on a
 * terminal, then defaults), checks every precondition and step, and only then
 * writes. The installation is recorded in `.boilerstone/boilerplate.json`.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { WEB_APPS } from './apps.js'
import { compareVersions } from './boilerplate-core.js'
import { applySteps, checkSteps, listSteps, type EngineContext } from './extension-engine.js'
import {
  describeRange,
  EXTENSION_MANIFEST_FILE,
  getOptionFlag,
  isCompatible,
  parseExtensionManifest,
  renderTemplate,
  WEB_APPS_CHOICES,
  type ExtensionManifest,
  type ExtensionOption,
  type OptionValue,
  type Precondition,
  type TemplateVariables,
} from './extension-manifest.js'
import { EXTENSIONS, resolveExtensionRemote } from './extensions.js'
import { cloneRelease } from './install.js'
import { Confirm, Input, MultiSelect, Select } from './prompts.js'
import { trackingState, type TrackingState } from './tracking-state.js'
import {
  canReadTty,
  colorize,
  describeError,
  findUpwards,
  info,
  ok,
  resolveProjectPath,
  runGit,
  spawnProcessSync,
} from './utils.js'

const BOOLEAN_FLAGS = new Set(['--yes', '--json', '--help'])
const COMMAND_FLAGS = new Set(['--project', '--ref'])
const RELEASE_TAG = /^v\d+\.\d+\.\d+$/
const STATE_FILE = join('.boilerstone', 'boilerplate.json')

export interface ExtensionSource {
  root: string
  /** Release without the leading v, or `local` for a working copy. */
  version: string
  manifest: ExtensionManifest
  cleanup: () => void
}

interface ParsedArgs {
  positionals: string[]
  values: Map<string, string>
  booleans: Set<string>
}

interface Project {
  root: string
  state: TrackingState
}

export function parseExtensionArgs(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = { positionals: [], values: new Map(), booleans: new Set() }
  for (let index = 0; index < args.length; index += 1) {
    const current = args[index]
    if (!current.startsWith('--')) {
      parsed.positionals.push(current)
      continue
    }
    const equals = current.indexOf('=')
    if (equals !== -1) {
      parsed.values.set(current.slice(0, equals), current.slice(equals + 1))
      continue
    }
    if (BOOLEAN_FLAGS.has(current)) {
      parsed.booleans.add(current)
      continue
    }
    const value = args[index + 1]
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`${current} requires a value`)
    }
    parsed.values.set(current, value)
    index += 1
  }
  return parsed
}

/** Release tags of a remote, newest first. */
export function listReleaseTags(remote: string): string[] {
  let output: string
  try {
    output = runGit(['ls-remote', '--tags', '--refs', remote])
  } catch (error) {
    throw new Error(`Cannot list the releases of ${remote}: ${describeError(error)}`, {
      cause: error,
    })
  }
  return output
    .split('\n')
    .map((line) => line.split('\t')[1]?.replace('refs/tags/', '') ?? '')
    .filter((tag) => RELEASE_TAG.test(tag))
    .sort((a, b) => compareVersions(b.slice(1), a.slice(1)))
}

function readManifest(root: string, source: string): ExtensionManifest {
  const path = join(root, EXTENSION_MANIFEST_FILE)
  if (!existsSync(path)) {
    throw new Error(`${source} has no ${EXTENSION_MANIFEST_FILE}`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf-8'))
  } catch (error) {
    throw new Error(`Invalid JSON in ${source}/${EXTENSION_MANIFEST_FILE}`, { cause: error })
  }
  return parseExtensionManifest(parsed, source)
}

function loadWorkingCopy(remote: string, projectVersion: string): ExtensionSource {
  const manifest = readManifest(remote, remote)
  if (!isCompatible(manifest.compatibility.boilerplate, projectVersion)) {
    throw new Error(
      `${remote} supports boilerplate ${describeRange(manifest.compatibility.boilerplate)}, this project is on ${projectVersion}`,
    )
  }
  return { root: resolve(remote), version: 'local', manifest, cleanup: () => undefined }
}

/** The manifest of one tag, cloned into a temporary folder the caller must clean up. */
function loadRelease(name: string, remote: string, tag: string): ExtensionSource {
  const root = mkdtempSync(join(tmpdir(), 'boilerstone-extension-'))
  const cleanup = (): void => rmSync(root, { recursive: true, force: true })
  try {
    cloneRelease(remote, tag, root)
    return { root, version: tag.slice(1), manifest: readManifest(root, `${name} ${tag}`), cleanup }
  } catch (error) {
    cleanup()
    throw error
  }
}

/**
 * Fetches the newest release compatible with `projectVersion`, or the one
 * `ref` names. A local directory without `ref` is used as it is.
 */
export function loadExtensionSource(options: {
  name: string
  remote: string
  projectVersion: string
  ref?: string
}): ExtensionSource {
  const { name, remote, projectVersion, ref } = options
  if (ref !== undefined && !RELEASE_TAG.test(ref)) {
    throw new Error(`--ref must be a release tag like v1.2.0, got '${ref}'`)
  }
  if (ref === undefined && existsSync(remote) && statSync(remote).isDirectory()) {
    return loadWorkingCopy(remote, projectVersion)
  }

  const tags = ref ? [ref] : listReleaseTags(remote)
  if (tags.length === 0) {
    throw new Error(`No release of '${name}' found at ${remote}`)
  }
  let newestRange: string | undefined
  for (const tag of tags) {
    const source = loadRelease(name, remote, tag)
    const range = source.manifest.compatibility.boilerplate
    if (isCompatible(range, projectVersion)) {
      return source
    }
    newestRange ??= describeRange(range)
    source.cleanup()
  }
  throw new Error(
    ref
      ? `${name} ${ref} supports boilerplate ${newestRange}, this project is on ${projectVersion}`
      : `No version of '${name}' supports boilerplate ${projectVersion} (the latest, ${tags[0]}, needs ${newestRange})`,
  )
}

export function listPresentWebApps(projectRoot: string): string[] {
  return WEB_APPS.filter((app) => existsSync(join(projectRoot, 'apps', app)))
}

function getOptionChoices(option: ExtensionOption, projectRoot: string): string[] | undefined {
  if (option.choices === WEB_APPS_CHOICES) {
    return listPresentWebApps(projectRoot)
  }
  return option.choices
}

function describeExpected(option: ExtensionOption, choices: string[] | undefined): string {
  if (choices) {
    return option.type === 'list'
      ? `one or more of ${choices.join(', ')} (comma separated)`
      : `one of ${choices.join(', ')}`
  }
  return option.patternHint ?? option.message
}

/** Returns an error message, or null when the value is valid. */
export function validateOptionValue(
  option: ExtensionOption,
  value: OptionValue,
  choices: string[] | undefined,
): string | null {
  const flag = getOptionFlag(option.name)
  const values = Array.isArray(value) ? value : [value]
  if (option.type === 'list' ? values.length === 0 : values[0] === '') {
    return `${flag} needs a value: ${describeExpected(option, choices)}`
  }
  for (const item of values) {
    if (choices && !choices.includes(item)) {
      return `${flag}: '${item}' is not valid, expected ${describeExpected(option, choices)}`
    }
    if (option.pattern && !new RegExp(option.pattern).test(item)) {
      return `${flag}: '${item}' is not valid, expected ${describeExpected(option, choices)}`
    }
    const forbidden = item.split('.').find((segment) => option.forbiddenSegments?.includes(segment))
    if (forbidden) {
      return `${flag}: '${forbidden}' is a reserved word and cannot be a segment of '${item}'`
    }
  }
  return null
}

function parseFlagValue(option: ExtensionOption, value: string): OptionValue {
  return option.type === 'list'
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : value.trim()
}

async function promptOption(
  option: ExtensionOption,
  choices: string[] | undefined,
  initial: OptionValue | undefined,
): Promise<OptionValue> {
  if (option.type === 'choice' && choices) {
    // Enquirer turns the choices it gets into objects: give it a copy.
    return new Select({
      name: option.name,
      message: option.message,
      choices: [...choices],
      ...(typeof initial === 'string' && choices.includes(initial)
        ? { initial: choices.indexOf(initial) }
        : {}),
    }).run()
  }
  if (option.type === 'list' && choices) {
    return new MultiSelect({
      name: option.name,
      message: `${option.message} (space to select)`,
      choices: [...choices],
      ...(Array.isArray(initial)
        ? { initial: initial.filter((item) => choices.includes(item)) }
        : {}),
    }).run()
  }
  return new Input({
    message: option.message,
    ...(typeof initial === 'string' ? { initial } : {}),
  }).run()
}

function readPackageName(path: string): string | undefined {
  if (!existsSync(path)) {
    return undefined
  }
  const name = (JSON.parse(readFileSync(path, 'utf-8')) as { name?: unknown }).name
  return typeof name === 'string' ? name : undefined
}

function getBuiltinVariables(projectRoot: string, app: string | undefined): TemplateVariables {
  const projectName = readPackageName(join(projectRoot, 'package.json')) ?? 'project'
  const appPackage = app
    ? readPackageName(join(projectRoot, 'apps', app, 'package.json'))
    : undefined
  const packageScope = appPackage?.startsWith('@')
    ? appPackage.split('/')[0]
    : `@${projectName.replace(/^@/, '').split('/')[0]}`
  return { projectName, packageScope, app: app ?? '', appPackage: appPackage ?? '' }
}

function renderDefault(
  option: ExtensionOption,
  variables: TemplateVariables,
): OptionValue | undefined {
  if (option.default === undefined) {
    return undefined
  }
  return Array.isArray(option.default)
    ? option.default.map((item) => renderTemplate(item, variables))
    : renderTemplate(option.default, variables)
}

async function resolveOptionValue(options: {
  option: ExtensionOption
  choices: string[] | undefined
  flagValue: string | undefined
  initial: OptionValue | undefined
  interactive: boolean
}): Promise<OptionValue> {
  const { option, choices, flagValue, initial, interactive } = options
  if (flagValue !== undefined) {
    return parseFlagValue(option, flagValue)
  }
  if (choices?.length === 0) {
    if (option.required) {
      throw new Error(
        `${getOptionFlag(option.name)} has no possible value in this project: ${option.message}`,
      )
    }
    return option.type === 'list' ? [] : ''
  }
  if (interactive) {
    return promptOption(option, choices, initial)
  }
  if (initial !== undefined) {
    return initial
  }
  if (option.type === 'choice' && choices?.length === 1) {
    return choices[0]
  }
  if (option.required) {
    throw new Error(
      `${getOptionFlag(option.name)} is required: ${describeExpected(option, choices)}`,
    )
  }
  return option.type === 'list' ? [] : ''
}

/**
 * Option values from flags, then a prompt when a terminal is available, then
 * the default. Throws on a missing required option or an invalid value.
 */
export async function resolveVariables(options: {
  manifest: ExtensionManifest
  projectRoot: string
  flags: Map<string, string>
  interactive: boolean
}): Promise<TemplateVariables> {
  const { manifest, projectRoot, flags, interactive } = options
  const variables: TemplateVariables = getBuiltinVariables(projectRoot, undefined)
  for (const option of manifest.options) {
    const choices = getOptionChoices(option, projectRoot)
    const value = await resolveOptionValue({
      option,
      choices,
      flagValue: flags.get(getOptionFlag(option.name)),
      initial: renderDefault(option, variables),
      interactive,
    })
    if (option.required || value.length > 0) {
      const problem = validateOptionValue(option, value, choices)
      if (problem) {
        throw new Error(problem)
      }
    }
    variables[option.name] = value
    if (option.name === 'app' && typeof value === 'string') {
      Object.assign(variables, getBuiltinVariables(projectRoot, value))
    }
  }
  return variables
}

function isTemplated(precondition: Precondition): boolean {
  return JSON.stringify(precondition).includes('{{')
}

function checkCleanTree(projectRoot: string): string | null {
  let status: string
  try {
    status = runGit(['status', '--porcelain'], projectRoot)
  } catch {
    return `${projectRoot} is not a git repository: commit the project first, so the changes are easy to review and undo`
  }
  if (!status) {
    return null
  }
  const files = status.split('\n')
  const listed = files.slice(0, 10).map((line) => `      ${line}`)
  const more = files.length > 10 ? `\n      … and ${files.length - 10} more` : ''
  return `Commit or stash your changes first:\n${listed.join('\n')}${more}`
}

export function checkPreconditions(
  preconditions: Precondition[],
  context: {
    projectRoot: string
    manifest: ExtensionManifest
    state: TrackingState
    variables: TemplateVariables
  },
): string[] {
  const { projectRoot, manifest, state, variables } = context
  const render = (text: string): string => renderTemplate(text, variables)
  const exists = (path: string): boolean => existsSync(join(projectRoot, render(path)))

  return preconditions.flatMap((precondition): string[] => {
    switch (precondition.type) {
      case 'clean-tree': {
        const problem = checkCleanTree(projectRoot)
        return problem ? [problem] : []
      }
      case 'not-installed': {
        const installed = state.extensions?.find((extension) => extension.name === manifest.name)
        return installed
          ? [
              `${manifest.name} ${installed.version} is already installed (on ${installed.installedAt}). There is no update command yet: follow "Updating" in ${manifest.docs ?? 'its documentation'}`,
            ]
          : []
      }
      case 'path-exists':
        return exists(precondition.path) ? [] : [render(precondition.message)]
      case 'any-of-paths':
        return precondition.paths.some(exists) ? [] : [render(precondition.message)]
    }
  })
}

function failWithIssues(issues: string[], manifest: ExtensionManifest): never {
  console.error(`\n${colorize('Nothing was changed. Problems found:', 'red')}`)
  for (const issue of issues) {
    console.error(`  ${colorize('✗', 'red')} ${issue}`)
  }
  // Nothing was copied, so the documentation is not in the project yet.
  const docs = manifest.docsUrl ?? manifest.docs
  if (docs) {
    console.error(`\n  Manual steps and troubleshooting: ${docs}`)
  }
  throw new Error(`${issues.length} problem(s) found, nothing was changed`)
}

function printUsage(): void {
  console.log(`
${colorize('Usage:', 'cyan')}
  boilerstone-cli extension list [--json]
  boilerstone-cli extension add <name> [--project <path>] [--ref vX.Y.Z] [--yes] [--<option> <value> ...]

${colorize('Extensions:', 'cyan')}
${Object.entries(EXTENSIONS)
  .map(([name, entry]) => `  ${colorize(name.padEnd(12), 'bright')} ${entry.description}`)
  .join('\n')}

${colorize('Options of add:', 'cyan')}
  ${colorize('--project <path>', 'bright')}   Project root (default: nearest folder with .boilerstone/boilerplate.json)
  ${colorize('--ref <vX.Y.Z>', 'bright')}     Extension release to install (default: newest compatible)
  ${colorize('--yes', 'bright')}              Do not ask before writing
  ${colorize('--<option>', 'bright')}         Any option of the extension, e.g. --app web-spa --app-id com.acme.app

${colorize('Examples:', 'cyan')}
  ${colorize('pnpm boilerplate extension add capacitor', 'dim')}
  ${colorize('pnpm boilerplate extension add capacitor --app web-spa --app-id com.acme.app --yes', 'dim')}
`)
}

function findProjectRoot(parsed: ParsedArgs): string | null {
  const projectValue = parsed.values.get('--project')
  return projectValue ? resolveProjectPath(projectValue) : findUpwards(process.cwd(), [STATE_FILE])
}

function cmdList(parsed: ParsedArgs): void {
  const root = findProjectRoot(parsed)
  const state = root ? trackingState.read(root) : null
  const rows = Object.entries(EXTENSIONS).map(([name, entry]) => {
    const installed = state?.extensions?.find((extension) => extension.name === name)
    return {
      name,
      description: entry.description,
      installed: Boolean(installed),
      ...(installed ? { version: installed.version } : {}),
    }
  })
  if (parsed.booleans.has('--json')) {
    console.log(JSON.stringify(rows, null, 2))
    return
  }
  for (const row of rows) {
    const status = row.installed ? colorize(`  (installed ${row.version})`, 'green') : ''
    console.log(`${colorize(row.name.padEnd(12), 'bright')} ${row.description}${status}`)
  }
}

function loadProject(parsed: ParsedArgs): Project {
  const root = findProjectRoot(parsed)
  const state = root ? trackingState.read(root) : null
  if (!root || !state) {
    throw new Error(
      `No .boilerstone/boilerplate.json found in ${root ?? process.cwd()} or its parents. Run this inside a boilerstone project, or run \`boilerstone-cli onboard\` first.`,
    )
  }
  return { root, state }
}

function checkFlags(parsed: ParsedArgs, manifest: ExtensionManifest): void {
  const optionFlags = new Set(manifest.options.map((option) => getOptionFlag(option.name)))
  for (const flag of parsed.values.keys()) {
    if (!COMMAND_FLAGS.has(flag) && !optionFlags.has(flag)) {
      throw new Error(
        `Unknown option ${flag}. Options of ${manifest.name}: ${[...optionFlags].join(', ') || 'none'}`,
      )
    }
  }
}

/** Resolves the options and checks the whole project; stops before writing on any problem. */
async function prepareInstall(options: {
  parsed: ParsedArgs
  project: Project
  source: ExtensionSource
  interactive: boolean
}): Promise<EngineContext> {
  const { parsed, project, source, interactive } = options
  const { manifest } = source
  const preconditionContext = {
    projectRoot: project.root,
    manifest,
    state: project.state,
    variables: getBuiltinVariables(project.root, undefined),
  }
  const early = checkPreconditions(
    manifest.preconditions.filter((precondition) => !isTemplated(precondition)),
    preconditionContext,
  )
  if (early.length > 0) {
    failWithIssues(early, manifest)
  }

  const variables = await resolveVariables({
    manifest,
    projectRoot: project.root,
    flags: parsed.values,
    interactive,
  })
  const context: EngineContext = {
    projectRoot: project.root,
    extensionRoot: source.root,
    manifest,
    variables,
  }
  const issues = [
    ...checkPreconditions(manifest.preconditions.filter(isTemplated), {
      ...preconditionContext,
      variables,
    }),
    ...checkSteps(context),
  ]
  if (issues.length > 0) {
    failWithIssues(issues, manifest)
  }
  return context
}

async function confirmPlan(context: EngineContext, interactive: boolean): Promise<boolean> {
  console.log(`\n${colorize('Planned changes:', 'cyan')}`)
  for (const label of listSteps(context)) {
    console.log(`  ${colorize('•', 'dim')} ${label}`)
  }
  if (!interactive) {
    return true
  }
  return new Confirm({ name: 'apply', message: 'Apply?', initial: true }).run()
}

function recordInstallation(
  project: Project,
  source: ExtensionSource,
  context: EngineContext,
): void {
  const options = Object.fromEntries(
    source.manifest.options.map((option) => [option.name, context.variables[option.name]]),
  )
  const latestState = trackingState.read(project.root) ?? project.state
  trackingState.write(
    project.root,
    trackingState.addExtension(latestState, {
      name: source.manifest.name,
      version: source.version,
      options,
    }),
  )
}

/**
 * Formats the files the extension wrote, and the tracking file, with the
 * project's oxfmt: a merged JSON file is rewritten whole, and copied files follow
 * the extension's style. oxfmt skips the files it ignores or does not handle.
 */
function formatChangedFiles(projectRoot: string, files: string[]): void {
  if (!existsSync(join(projectRoot, 'node_modules', '.bin', 'oxfmt'))) {
    return
  }
  const result = spawnProcessSync(
    'pnpm',
    ['exec', 'oxfmt', '--no-error-on-unmatched-pattern', ...files],
    { cwd: projectRoot, stdio: 'ignore' },
  )
  if (result.status !== 0) {
    console.log(
      `  ${colorize('⚠', 'yellow')} oxfmt could not format the changed files: run your formatter before committing`,
    )
  }
}

function printSummary(project: Project, source: ExtensionSource, context: EngineContext): void {
  const { manifest } = source
  console.log('')
  ok(`${manifest.name} ${source.version} installed`)
  try {
    const changes = runGit(['status', '--short'], project.root, { trimStart: false })
    if (changes) {
      console.log(`\n${colorize('Changed files:', 'cyan')}\n${changes}`)
    }
  } catch {
    // Not a git repository: nothing more to show.
  }
  if (manifest.nextSteps?.length) {
    console.log(`\n${colorize('Next steps:', 'cyan')}`)
    for (const line of manifest.nextSteps) {
      console.log(`  ${renderTemplate(line, context.variables)}`)
    }
  }
  if (manifest.docs) {
    console.log(
      `\n${colorize('Documentation:', 'cyan')} ${renderTemplate(manifest.docs, context.variables)}`,
    )
  }
}

async function cmdAdd(parsed: ParsedArgs): Promise<void> {
  const name = parsed.positionals[0]
  if (!name) {
    throw new Error(`extension add needs a name. Available: ${Object.keys(EXTENSIONS).join(', ')}`)
  }
  const project = loadProject(parsed)
  const remote = resolveExtensionRemote(name)
  info(`Fetching ${name}…`)
  const source = loadExtensionSource({
    name,
    remote,
    projectVersion: project.state.source.currentVersion,
    ref: parsed.values.get('--ref'),
  })
  try {
    if (source.manifest.name !== name) {
      throw new Error(`${remote} holds the extension '${source.manifest.name}', not '${name}'`)
    }
    checkFlags(parsed, source.manifest)
    ok(`${name} ${source.version} — ${source.manifest.description}`)

    const interactive = !parsed.booleans.has('--yes') && canReadTty()
    const context = await prepareInstall({ parsed, project, source, interactive })
    if (!(await confirmPlan(context, interactive))) {
      console.log('Cancelled, nothing was changed.')
      return
    }
    console.log('')
    const { changedFiles } = applySteps(context, {
      log: (label) => info(label),
      gitRollback: source.manifest.preconditions.some(
        (precondition) => precondition.type === 'clean-tree',
      ),
      record: () => recordInstallation(project, source, context),
    })
    formatChangedFiles(project.root, [...changedFiles, STATE_FILE])
    printSummary(project, source, context)
  } finally {
    source.cleanup()
  }
}

/** Entry point for `boilerstone-cli extension …`; `args` start after `extension`. */
export async function runExtensionCli(args: string[]): Promise<void> {
  try {
    const [subcommand, ...rest] = args
    const parsed = parseExtensionArgs(rest)
    if (subcommand === 'list') {
      cmdList(parsed)
    } else if (subcommand === 'add' && !parsed.booleans.has('--help')) {
      await cmdAdd(parsed)
    } else {
      printUsage()
    }
  } catch (error) {
    console.error(`\n${colorize('❌', 'red')} ${describeError(error)}`)
    process.exit(1)
  }
}
