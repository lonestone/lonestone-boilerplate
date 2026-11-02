/**
 * The manifest of an extension (`extension.json` at the root of its repository).
 *
 * An extension only declares options and steps of a few fixed types. The CLI
 * runs them itself, so it can check every step against a project before it
 * writes anything, and undo them when one fails. See `extension-engine.ts`.
 */
import { compareVersions } from './boilerplate-core.js'
import { isRecord } from './utils.js'

export const EXTENSION_MANIFEST_FILE = 'extension.json'

/** Placeholder for `choices`: the web apps present in the project. */
export const WEB_APPS_CHOICES = '$webApps'

/** Variables every template can use, on top of the option values. */
export const BUILTIN_VARIABLES = ['projectName', 'packageScope', 'app', 'appPackage'] as const

export type OptionValue = string | string[]
export type TemplateVariables = Record<string, OptionValue>

export interface ExtensionOption {
  name: string
  type: 'choice' | 'string' | 'list'
  message: string
  choices?: string[] | typeof WEB_APPS_CHOICES
  default?: OptionValue
  pattern?: string
  patternHint?: string
  forbiddenSegments?: string[]
  required?: boolean
}

export type Precondition =
  | { type: 'clean-tree' }
  | { type: 'not-installed' }
  | { type: 'path-exists'; path: string; message: string }
  | { type: 'any-of-paths'; paths: string[]; message: string }

/**
 * Conditions of a step, all of which must hold. A key is an option name
 * (a list option matches when it contains the value), or `pathExists`.
 */
export type StepCondition = Record<string, string>

interface StepBase {
  when?: StepCondition
  /** `post`: the targets come from an earlier `run` step, so only the sources are prechecked. */
  phase?: 'pre' | 'post'
}

export interface CopyStep extends StepBase {
  type: 'copy'
  /** File or directory of the extension. */
  from?: string
  /** File of the project. */
  fromProject?: string
  to: string
  render?: boolean
  ifExists?: 'fail' | 'skip' | 'overwrite'
  /** Path inside `from` → project path that must exist for that file to be copied. */
  requires?: Record<string, string>
}

export interface PatchStep extends StepBase {
  type: 'patch'
  file: string
  find?: string
  action: 'before' | 'after' | 'replace' | 'prepend'
  text: string
}

export interface JsonMergeStep extends StepBase {
  type: 'json-merge'
  file: string
  merge: Record<string, unknown>
}

export interface EnvListAppendStep extends StepBase {
  type: 'env-list-append'
  files: string[]
  /** Files that are changed only when they exist and define the key, like a local `.env`. */
  optional?: string[]
  key: string
  values: string[]
}

export interface GitignoreStep extends StepBase {
  type: 'gitignore'
  file: string
  lines: string[]
}

export interface RunStep extends StepBase {
  type: 'run'
  command: string
  args: string[]
  cwd?: string
  /** Paths the command creates, removed when the installation is rolled back. */
  creates?: string[]
  allowFailure?: boolean
  failureHint?: string
}

export type ExtensionStep =
  | CopyStep
  | PatchStep
  | JsonMergeStep
  | EnvListAppendStep
  | GitignoreStep
  | RunStep

export interface CompatibilityRange {
  min: string
  below?: string
}

export interface ExtensionManifest {
  schemaVersion: 1
  name: string
  description: string
  compatibility: { boilerplate: CompatibilityRange }
  options: ExtensionOption[]
  preconditions: Precondition[]
  steps: ExtensionStep[]
  docs?: string
  /** The documentation online, for when the install stops before copying `docs`. */
  docsUrl?: string
  nextSteps?: string[]
}

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/
const VARIABLE_PATTERN = /\{\{\s*([A-Za-z][A-Za-z0-9]*)\s*\}\}/g

/** Problems found while parsing, reported together at the end. */
type Issues = string[]

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === 'string')
}

export function isSafeRelativePath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.startsWith('/') &&
    !/^[A-Za-z]:/.test(path) &&
    !path.includes('\\') &&
    !path.split('/').includes('..')
  )
}

/** `--app-id` for `appId`. */
export function getOptionFlag(name: string): string {
  return `--${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`
}

export function isCompatible(range: CompatibilityRange, version: string): boolean {
  const normalized = version.replace(/^v/, '')
  if (compareVersions(normalized, range.min) < 0) {
    return false
  }
  return range.below === undefined || compareVersions(normalized, range.below) < 0
}

export function describeRange(range: CompatibilityRange): string {
  return range.below ? `>= ${range.min} and < ${range.below}` : `>= ${range.min}`
}

export function renderTemplate(text: string, variables: TemplateVariables): string {
  return text.replace(VARIABLE_PATTERN, (_match, name: string) => {
    const value = variables[name]
    if (value === undefined) {
      throw new Error(`no value for {{${name}}}`)
    }
    return Array.isArray(value) ? value.join(',') : value
  })
}

/** Renders every string (and object key) of a JSON value. */
export function renderJson(value: unknown, variables: TemplateVariables): unknown {
  if (typeof value === 'string') {
    return renderTemplate(value, variables)
  }
  if (Array.isArray(value)) {
    return value.map((item) => renderJson(item, variables))
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        renderTemplate(key, variables),
        renderJson(item, variables),
      ]),
    )
  }
  return value
}

function collectVariables(value: unknown, found: Set<string>): void {
  if (typeof value === 'string') {
    for (const match of value.matchAll(VARIABLE_PATTERN)) {
      found.add(match[1])
    }
  } else if (Array.isArray(value)) {
    for (const item of value) {
      collectVariables(item, found)
    }
  } else if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      collectVariables(key, found)
      collectVariables(item, found)
    }
  }
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: Issues,
): string {
  const value = record[key]
  if (typeof value !== 'string' || value.length === 0) {
    issues.push(`${path}.${key} is required`)
    return ''
  }
  return value
}

function readOptionalString(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: Issues,
): string | undefined {
  const value = record[key]
  if (value !== undefined && typeof value !== 'string') {
    issues.push(`${path}.${key} must be a string`)
    return undefined
  }
  return value
}

function requireStringArray(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: Issues,
): string[] {
  const value = record[key]
  if (!isStringArray(value)) {
    issues.push(`${path}.${key} must be an array of strings`)
    return []
  }
  return value
}

function checkPath(value: string | undefined, path: string, issues: Issues): void {
  if (value !== undefined && !isSafeRelativePath(value)) {
    issues.push(`${path}: path must be relative and must not contain '..'`)
  }
}

function checkOptionChoices(
  value: Record<string, unknown>,
  path: string,
  issues: Issues,
): ExtensionOption['choices'] {
  const { choices, type } = value
  if (
    choices !== undefined &&
    choices !== WEB_APPS_CHOICES &&
    !(isStringArray(choices) && choices.length > 0)
  ) {
    issues.push(`${path}.choices must be a non-empty array of strings or "${WEB_APPS_CHOICES}"`)
  }
  if ((type === 'choice' || type === 'list') && choices === undefined) {
    issues.push(`${path}.choices is required for a ${type} option`)
  }
  return choices as ExtensionOption['choices']
}

function readOptionPattern(
  value: Record<string, unknown>,
  path: string,
  issues: Issues,
): string | undefined {
  const pattern = readOptionalString(value, 'pattern', path, issues)
  if (pattern !== undefined) {
    try {
      new RegExp(pattern)
    } catch {
      issues.push(`${path}.pattern is not a valid regular expression`)
    }
  }
  return pattern
}

function parseOption(value: unknown, path: string, issues: Issues): ExtensionOption {
  if (!isRecord(value)) {
    issues.push(`${path} must be an object`)
    return { name: '', type: 'string', message: '' }
  }
  const name = requireString(value, 'name', path, issues)
  if (name && !/^[a-z][A-Za-z0-9]*$/.test(name)) {
    issues.push(`${path}.name must be camelCase`)
  }
  const type = value.type
  if (type !== 'choice' && type !== 'string' && type !== 'list') {
    issues.push(`${path}.type must be choice, string or list`)
  }
  const choices = checkOptionChoices(value, path, issues)
  const pattern = readOptionPattern(value, path, issues)
  const defaultValue = value.default
  if (
    defaultValue !== undefined &&
    typeof defaultValue !== 'string' &&
    !isStringArray(defaultValue)
  ) {
    issues.push(`${path}.default must be a string or an array of strings`)
  }
  if (value.forbiddenSegments !== undefined && !isStringArray(value.forbiddenSegments)) {
    issues.push(`${path}.forbiddenSegments must be an array of strings`)
  }

  return {
    name,
    type: type as ExtensionOption['type'],
    message: requireString(value, 'message', path, issues),
    ...(choices !== undefined ? { choices } : {}),
    ...(defaultValue !== undefined ? { default: defaultValue as OptionValue } : {}),
    ...(pattern !== undefined ? { pattern } : {}),
    ...(typeof value.patternHint === 'string' ? { patternHint: value.patternHint } : {}),
    ...(isStringArray(value.forbiddenSegments)
      ? { forbiddenSegments: value.forbiddenSegments }
      : {}),
    ...(value.required === true ? { required: true } : {}),
  }
}

function parsePrecondition(value: unknown, path: string, issues: Issues): Precondition {
  if (!isRecord(value)) {
    issues.push(`${path} must be an object`)
    return { type: 'clean-tree' }
  }
  switch (value.type) {
    case 'clean-tree':
    case 'not-installed':
      return { type: value.type }
    case 'path-exists': {
      const target = requireString(value, 'path', path, issues)
      checkPath(target, `${path}.path`, issues)
      return {
        type: 'path-exists',
        path: target,
        message: requireString(value, 'message', path, issues),
      }
    }
    case 'any-of-paths': {
      const paths = requireStringArray(value, 'paths', path, issues)
      paths.forEach((item, index) => checkPath(item, `${path}.paths[${index}]`, issues))
      return {
        type: 'any-of-paths',
        paths,
        message: requireString(value, 'message', path, issues),
      }
    }
    default:
      issues.push(`${path}: unknown precondition type '${String(value.type)}'`)
      return { type: 'clean-tree' }
  }
}

function parseStepBase(value: Record<string, unknown>, path: string, issues: Issues): StepBase {
  const base: StepBase = {}
  if (value.when !== undefined) {
    if (!isStringRecord(value.when)) {
      issues.push(`${path}.when must map option names or pathExists to strings`)
    } else {
      base.when = value.when
      checkPath(base.when.pathExists, `${path}.when.pathExists`, issues)
    }
  }
  if (value.phase !== undefined) {
    if (value.phase !== 'pre' && value.phase !== 'post') {
      issues.push(`${path}.phase must be pre or post`)
    } else {
      base.phase = value.phase
    }
  }
  return base
}

function parseCopyRequires(
  value: Record<string, unknown>,
  path: string,
  issues: Issues,
): Record<string, string> | undefined {
  if (value.requires === undefined) {
    return undefined
  }
  if (!isStringRecord(value.requires)) {
    issues.push(`${path}.requires must map paths to project paths`)
    return undefined
  }
  for (const [inner, projectPath] of Object.entries(value.requires)) {
    checkPath(inner, `${path}.requires`, issues)
    checkPath(projectPath, `${path}.requires.${inner}`, issues)
  }
  return value.requires
}

function parseCopyStep(
  value: Record<string, unknown>,
  path: string,
  issues: Issues,
  base: StepBase,
): CopyStep {
  const from = readOptionalString(value, 'from', path, issues)
  const fromProject = readOptionalString(value, 'fromProject', path, issues)
  if ((from === undefined) === (fromProject === undefined)) {
    issues.push(`${path}: copy needs exactly one of from and fromProject`)
  }
  const to = requireString(value, 'to', path, issues)
  checkPath(from, `${path}.from`, issues)
  checkPath(fromProject, `${path}.fromProject`, issues)
  checkPath(to, `${path}.to`, issues)
  const ifExists = value.ifExists
  if (
    ifExists !== undefined &&
    ifExists !== 'fail' &&
    ifExists !== 'skip' &&
    ifExists !== 'overwrite'
  ) {
    issues.push(`${path}.ifExists must be fail, skip or overwrite`)
  }
  const requires = parseCopyRequires(value, path, issues)
  return {
    ...base,
    type: 'copy',
    ...(from !== undefined ? { from } : {}),
    ...(fromProject !== undefined ? { fromProject } : {}),
    to,
    ...(value.render === true ? { render: true } : {}),
    ...(ifExists !== undefined ? { ifExists: ifExists as CopyStep['ifExists'] } : {}),
    ...(requires ? { requires } : {}),
  }
}

function parsePatchStep(
  value: Record<string, unknown>,
  path: string,
  issues: Issues,
  base: StepBase,
): PatchStep {
  const file = requireString(value, 'file', path, issues)
  checkPath(file, `${path}.file`, issues)
  const action = value.action
  if (action !== 'before' && action !== 'after' && action !== 'replace' && action !== 'prepend') {
    issues.push(`${path}.action must be before, after, replace or prepend`)
  }
  const find = readOptionalString(value, 'find', path, issues)
  if (action !== 'prepend' && !find) {
    issues.push(`${path}.find is required`)
  }
  if (typeof value.text !== 'string') {
    issues.push(`${path}.text is required`)
  }
  return {
    ...base,
    type: 'patch',
    file,
    ...(find !== undefined ? { find } : {}),
    action: action as PatchStep['action'],
    text: typeof value.text === 'string' ? value.text : '',
  }
}

function parseJsonMergeStep(
  value: Record<string, unknown>,
  path: string,
  issues: Issues,
  base: StepBase,
): JsonMergeStep {
  const file = requireString(value, 'file', path, issues)
  checkPath(file, `${path}.file`, issues)
  if (!isRecord(value.merge)) {
    issues.push(`${path}.merge must be an object`)
  }
  return { ...base, type: 'json-merge', file, merge: isRecord(value.merge) ? value.merge : {} }
}

function parseEnvListAppendStep(
  value: Record<string, unknown>,
  path: string,
  issues: Issues,
  base: StepBase,
): EnvListAppendStep {
  const files = requireStringArray(value, 'files', path, issues)
  const optional =
    value.optional === undefined ? [] : requireStringArray(value, 'optional', path, issues)
  for (const [index, file] of [...files, ...optional].entries()) {
    checkPath(file, `${path}.files[${index}]`, issues)
  }
  const key = requireString(value, 'key', path, issues)
  if (key && !/^[A-Z][A-Z0-9_]*$/.test(key)) {
    issues.push(`${path}.key must be an environment variable name`)
  }
  return {
    ...base,
    type: 'env-list-append',
    files,
    ...(optional.length > 0 ? { optional } : {}),
    key,
    values: requireStringArray(value, 'values', path, issues),
  }
}

function parseGitignoreStep(
  value: Record<string, unknown>,
  path: string,
  issues: Issues,
  base: StepBase,
): GitignoreStep {
  const file = requireString(value, 'file', path, issues)
  checkPath(file, `${path}.file`, issues)
  return {
    ...base,
    type: 'gitignore',
    file,
    lines: requireStringArray(value, 'lines', path, issues),
  }
}

function parseRunStep(
  value: Record<string, unknown>,
  path: string,
  issues: Issues,
  base: StepBase,
): RunStep {
  const command = requireString(value, 'command', path, issues)
  const cwd = readOptionalString(value, 'cwd', path, issues)
  checkPath(cwd, `${path}.cwd`, issues)
  const creates =
    value.creates === undefined ? undefined : requireStringArray(value, 'creates', path, issues)
  creates?.forEach((item, index) => checkPath(item, `${path}.creates[${index}]`, issues))
  return {
    ...base,
    type: 'run',
    command,
    args: value.args === undefined ? [] : requireStringArray(value, 'args', path, issues),
    ...(cwd !== undefined ? { cwd } : {}),
    ...(creates ? { creates } : {}),
    ...(value.allowFailure === true ? { allowFailure: true } : {}),
    ...(typeof value.failureHint === 'string' ? { failureHint: value.failureHint } : {}),
  }
}

const STEP_PARSERS: Record<
  ExtensionStep['type'],
  (value: Record<string, unknown>, path: string, issues: Issues, base: StepBase) => ExtensionStep
> = {
  copy: parseCopyStep,
  patch: parsePatchStep,
  'json-merge': parseJsonMergeStep,
  'env-list-append': parseEnvListAppendStep,
  gitignore: parseGitignoreStep,
  run: parseRunStep,
}

function parseStep(value: unknown, path: string, issues: Issues): ExtensionStep | null {
  if (!isRecord(value)) {
    issues.push(`${path} must be an object`)
    return null
  }
  const parser = STEP_PARSERS[value.type as ExtensionStep['type']]
  if (!parser) {
    issues.push(`${path}: unknown step type '${String(value.type)}'`)
    return null
  }
  return parser(value, path, issues, parseStepBase(value, path, issues))
}

function parseCompatibility(value: unknown, issues: Issues): CompatibilityRange {
  const range: CompatibilityRange = { min: '' }
  const boilerplate = isRecord(value) ? value.boilerplate : undefined
  if (!isRecord(boilerplate)) {
    issues.push('compatibility.boilerplate is required')
    return range
  }
  if (typeof boilerplate.min !== 'string' || !VERSION_PATTERN.test(boilerplate.min)) {
    issues.push('compatibility.boilerplate.min must be a version (X.Y.Z)')
  } else {
    range.min = boilerplate.min
  }
  if (boilerplate.below !== undefined) {
    if (typeof boilerplate.below !== 'string' || !VERSION_PATTERN.test(boilerplate.below)) {
      issues.push('compatibility.boilerplate.below must be a version (X.Y.Z)')
    } else {
      range.below = boilerplate.below
    }
  }
  return range
}

function parseOptions(value: unknown, issues: Issues): ExtensionOption[] {
  if (value === undefined) {
    return []
  }
  if (!Array.isArray(value)) {
    issues.push('options must be an array')
    return []
  }
  const options = value.map((option, index) => parseOption(option, `options[${index}]`, issues))
  const names = options.map((option) => option.name)
  for (const duplicate of names.filter((name, index) => names.indexOf(name) !== index)) {
    issues.push(`options: duplicate option '${duplicate}'`)
  }
  return options
}

/** Every `{{var}}` must be a builtin variable or an option, and every `when` key an option. */
function checkTemplateVariables(
  manifest: Omit<ExtensionManifest, 'schemaVersion'>,
  issues: Issues,
): void {
  const optionNames = manifest.options.map((option) => option.name)
  const known = new Set<string>([...BUILTIN_VARIABLES, ...optionNames])
  const used = new Set<string>()
  collectVariables(
    [
      manifest.options.map((option) => option.default),
      manifest.preconditions,
      manifest.steps,
      manifest.docs,
      manifest.nextSteps,
    ],
    used,
  )
  for (const variable of used) {
    if (!known.has(variable)) {
      issues.push(`unknown template variable {{${variable}}}`)
    }
  }
  for (const step of manifest.steps) {
    for (const key of Object.keys(step.when ?? {})) {
      if (key !== 'pathExists' && !optionNames.includes(key)) {
        issues.push(`when: unknown option '${key}'`)
      }
    }
  }
}

/**
 * Validates a parsed `extension.json`. Throws one Error that lists every
 * problem, so an extension author fixes them in one pass.
 */
export function parseExtensionManifest(value: unknown, source: string): ExtensionManifest {
  if (!isRecord(value)) {
    throw new Error(`Invalid extension manifest (${source}): expected a JSON object`)
  }
  const issues: Issues = []
  if (value.schemaVersion !== 1) {
    issues.push('schemaVersion must be 1')
  }
  const name = requireString(value, 'name', 'manifest', issues)
  if (name && !/^[a-z][a-z0-9-]*$/.test(name)) {
    issues.push('name must be kebab-case')
  }
  if (!Array.isArray(value.steps) || value.steps.length === 0) {
    issues.push('steps must be a non-empty array')
  }
  const docs = readOptionalString(value, 'docs', 'manifest', issues)
  const docsUrl = readOptionalString(value, 'docsUrl', 'manifest', issues)
  const nextSteps =
    value.nextSteps === undefined
      ? undefined
      : requireStringArray(value, 'nextSteps', 'manifest', issues)
  const manifest = {
    name,
    description: requireString(value, 'description', 'manifest', issues),
    compatibility: { boilerplate: parseCompatibility(value.compatibility, issues) },
    options: parseOptions(value.options, issues),
    preconditions: (Array.isArray(value.preconditions) ? value.preconditions : []).map(
      (item, index) => parsePrecondition(item, `preconditions[${index}]`, issues),
    ),
    steps: (Array.isArray(value.steps) ? value.steps : [])
      .map((step, index) => parseStep(step, `steps[${index}]`, issues))
      .filter((step): step is ExtensionStep => step !== null),
    ...(docs !== undefined ? { docs } : {}),
    ...(docsUrl !== undefined ? { docsUrl } : {}),
    ...(nextSteps !== undefined ? { nextSteps } : {}),
  }
  checkTemplateVariables(manifest, issues)

  if (issues.length > 0) {
    throw new Error(
      `Invalid extension manifest (${source}):\n${issues.map((issue) => `  - ${issue}`).join('\n')}`,
    )
  }
  return { schemaVersion: 1, ...manifest }
}
