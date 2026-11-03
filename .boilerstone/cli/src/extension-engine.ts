/**
 * Runs the steps of an extension manifest against a project.
 *
 * `checkSteps` simulates every step on an in-memory copy of the files it
 * touches and reports all the problems at once, so a project that diverged
 * from the boilerplate gets a precise list before anything is written.
 * `applySteps` writes, keeps the original of every file it changes, and puts
 * the project back as it was when a step fails.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, delimiter, dirname, join, relative, sep } from 'node:path'
import process from 'node:process'
import { ensureGitignoreLine } from './boilerplate-core.js'
import {
  isSafeRelativePath,
  renderJson,
  renderTemplate,
  type CopyStep,
  type EnvListAppendStep,
  type ExtensionManifest,
  type ExtensionStep,
  type GitignoreStep,
  type JsonMergeStep,
  type PatchStep,
  type RunStep,
  type StepCondition,
  type TemplateVariables,
} from './extension-manifest.js'
import {
  describeError,
  isRecord,
  isWindows,
  listFilesRecursively,
  runGit,
  spawnProcessSync,
} from './utils.js'

export interface EngineContext {
  projectRoot: string
  extensionRoot: string
  manifest: ExtensionManifest
  variables: TemplateVariables
}

export interface ApplyOptions {
  log: (message: string) => void
  /** Also restore tracked files and remove untracked ones with git: the tree was clean before. */
  gitRollback?: boolean
  /** Runs after the last step; when it fails, the steps are rolled back too. */
  record?: () => void
}

export interface ApplyResult {
  changedFiles: string[]
}

export class StepFailedError extends Error {}

interface CopyEntry {
  source: string
  target: string
  render: boolean
}

/** Project files as the steps leave them; `null` means absent. */
interface FileOverlay {
  exists: (path: string) => boolean
  read: (path: string) => string | null
  write: (path: string, content: string) => void
  /** Paths written so far, with their final content. */
  written: () => Map<string, string | null>
}

/** Writes to the project and remembers what to restore. */
interface ProjectWriter {
  read: (path: string) => string | null
  write: (path: string, content: string | Buffer) => void
  /** A path a command may create, removed on rollback when it did not exist before. */
  expect: (path: string) => void
}

function createFileOverlay(root: string): FileOverlay {
  const files = new Map<string, string | null>()
  return {
    exists: (path) => {
      const content = files.get(path)
      return content === undefined ? existsSync(join(root, path)) : content !== null
    },
    read: (path) => {
      const content = files.get(path)
      if (content !== undefined) {
        return content
      }
      const absolute = join(root, path)
      return existsSync(absolute) && statSync(absolute).isFile()
        ? readFileSync(absolute, 'utf-8')
        : null
    },
    write: (path, content) => {
      files.set(path, content)
    },
    written: () => files,
  }
}

function toPosix(path: string): string {
  return path.split(sep).join('/')
}

function render(text: string, context: EngineContext): string {
  return renderTemplate(text, context.variables)
}

/** The manifest check sees paths before the option values are in: check them again after. */
function assertInsideProject(path: string): string {
  if (!isSafeRelativePath(path)) {
    throw new Error(`${path} is not a relative path inside the project`)
  }
  return path
}

function renderPath(path: string, context: EngineContext): string {
  return assertInsideProject(render(path, context))
}

export function describeStep(step: ExtensionStep, variables: TemplateVariables): string {
  const text = (value: string): string => renderTemplate(value, variables)
  switch (step.type) {
    case 'copy':
      return `copy ${step.from ?? text(step.fromProject ?? '')} → ${text(step.to)}`
    case 'patch':
      return `patch ${text(step.file)}`
    case 'json-merge':
    case 'gitignore':
      return `update ${text(step.file)}`
    case 'env-list-append':
      return `add to ${step.key} in ${[...step.files, ...(step.optional ?? [])].map(text).join(', ')}`
    case 'run':
      return `run ${[step.command, ...step.args.map(text)].join(' ')}`
  }
}

/** Whether every entry of `when` holds, files read from the overlay when there is one. */
export function isConditionMet(
  when: StepCondition | undefined,
  context: EngineContext,
  overlay?: FileOverlay,
): boolean {
  const exists = (expected: string): boolean => {
    const path = renderPath(expected, context)
    return overlay ? overlay.exists(path) : existsSync(join(context.projectRoot, path))
  }
  return Object.entries(when ?? {}).every(([key, expected]) => {
    if (key === 'pathExists') {
      return exists(expected)
    }
    if (key === 'pathMissing') {
      return !exists(expected)
    }
    const value = context.variables[key]
    return Array.isArray(value) ? value.includes(expected) : value === expected
  })
}

function stepApplies(step: ExtensionStep, context: EngineContext, overlay?: FileOverlay): boolean {
  return isConditionMet(step.when, context, overlay)
}

/** The files a copy step writes, after `requires` filtering. */
function planCopy(
  step: CopyStep,
  context: EngineContext,
  exists: (path: string) => boolean,
): CopyEntry[] {
  const target = renderPath(step.to, context)
  const renderFiles = step.render === true
  if (step.fromProject !== undefined) {
    return [
      {
        source: join(context.projectRoot, renderPath(step.fromProject, context)),
        target,
        render: renderFiles,
      },
    ]
  }

  const source = join(context.extensionRoot, step.from ?? '')
  if (!existsSync(source) || !statSync(source).isDirectory()) {
    const fileTarget = target.endsWith('/') ? `${target}${basename(source)}` : target
    return [{ source, target: fileTarget, render: renderFiles }]
  }

  return listFilesRecursively(source, '').flatMap((file) => {
    const inner = toPosix(file)
    const required = step.requires?.[inner]
    if (required !== undefined && !exists(renderPath(required, context))) {
      return []
    }
    const innerTarget = renderFiles ? render(inner, context) : inner
    return [
      {
        source: join(source, file),
        target: assertInsideProject(`${target.replace(/\/$/, '')}/${innerTarget}`),
        render: renderFiles,
      },
    ]
  })
}

function readSource(entry: CopyEntry, context: EngineContext): Buffer {
  const content = readFileSync(entry.source)
  // Binary files (images) are copied as they are.
  if (!entry.render || content.includes(0)) {
    return content
  }
  return Buffer.from(render(content.toString('utf-8'), context))
}

function countOccurrences(content: string, text: string): number {
  return content.split(text).length - 1
}

export function applyPatch(content: string, step: PatchStep, context: EngineContext): string {
  const text = render(step.text, context)
  if (step.action === 'prepend') {
    return `${text}${content}`
  }
  const find = render(step.find ?? '', context)
  const count = countOccurrences(content, find)
  if (count !== 1) {
    throw new Error(`expected text ${JSON.stringify(find)} found ${count} times, needs exactly 1`)
  }
  const replacement =
    step.action === 'before' ? `${text}${find}` : step.action === 'after' ? `${find}${text}` : text
  return content.replace(find, () => replacement)
}

/** Deep merge where arrays gain the missing items and a different scalar is a conflict. */
export function mergeJson(
  target: Record<string, unknown>,
  merge: Record<string, unknown>,
  path = '',
): { result: Record<string, unknown>; conflicts: string[] } {
  const result: Record<string, unknown> = { ...target }
  const conflicts: string[] = []
  for (const [key, value] of Object.entries(merge)) {
    const keyPath = path ? `${path}.${key}` : key
    const current = result[key]
    if (current === undefined) {
      result[key] = value
    } else if (Array.isArray(current) && Array.isArray(value)) {
      const seen = new Set(current.map((item) => JSON.stringify(item)))
      result[key] = [...current, ...value.filter((item) => !seen.has(JSON.stringify(item)))]
    } else if (isRecord(current) && isRecord(value)) {
      const nested = mergeJson(current, value, keyPath)
      result[key] = nested.result
      conflicts.push(...nested.conflicts)
    } else if (JSON.stringify(current) !== JSON.stringify(value)) {
      conflicts.push(keyPath)
    }
  }
  return { result, conflicts }
}

function mergeJsonFile(
  content: string,
  merge: Record<string, unknown>,
  context: EngineContext,
): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('is not valid JSON')
  }
  if (!isRecord(parsed)) {
    throw new Error('is not a JSON object')
  }
  const rendered = renderJson(merge, context.variables) as Record<string, unknown>
  const { result, conflicts } = mergeJson(parsed, rendered)
  if (conflicts.length > 0) {
    throw new Error(
      conflicts.map((conflict) => `${conflict} already has a different value`).join('; '),
    )
  }
  return `${JSON.stringify(result, null, 2)}\n`
}

/**
 * Appends the missing values to a comma-separated `KEY=` line. Returns null
 * when the key is not defined, which only optional files tolerate.
 */
export function appendEnvList(content: string, key: string, values: string[]): string | null {
  const pattern = new RegExp(`^([ \\t]*${key}[ \\t]*=[ \\t]*)(["']?)(.*?)\\2[ \\t]*$`, 'gm')
  const matches = [...content.matchAll(pattern)]
  if (matches.length === 0) {
    return null
  }
  if (matches.length > 1) {
    throw new Error(`defines ${key} ${matches.length} times`)
  }
  const [line, prefix, quote, current] = matches[0]
  const items = current
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const missing = values.filter((value) => !items.includes(value))
  if (missing.length === 0) {
    return content
  }
  // Splice at the match: the same text can also sit in a comment or a longer key above it.
  const start = matches[0].index
  const updatedLine = `${prefix}${quote}${[...items, ...missing].join(',')}${quote}`
  return `${content.slice(0, start)}${updatedLine}${content.slice(start + line.length)}`
}

/** Adds the missing lines under a header naming the extension. */
export function appendGitignore(
  content: string | null,
  lines: string[],
  extensionName: string,
): string {
  const current = content ?? ''
  const missing = lines.filter((line) => ensureGitignoreLine(current, line).changed)
  if (missing.length === 0) {
    return current
  }
  const base = current ? `${current.replace(/\n*$/, '')}\n\n` : ''
  return [`# Added by the ${extensionName} extension`, ...missing].reduce(
    (result, line) => ensureGitignoreLine(result, line).content,
    base,
  )
}

function commandExists(command: string): boolean {
  const extensions = isWindows ? ['.cmd', '.exe', ''] : ['']
  return (process.env.PATH ?? '')
    .split(delimiter)
    .filter(Boolean)
    .some((directory) =>
      extensions.some((extension) => existsSync(join(directory, `${command}${extension}`))),
    )
}

function listEnvFiles(
  step: EnvListAppendStep,
  context: EngineContext,
): { path: string; optional: boolean }[] {
  return [
    ...step.files.map((file) => ({ path: renderPath(file, context), optional: false })),
    ...(step.optional ?? []).map((file) => ({ path: renderPath(file, context), optional: true })),
  ]
}

function renderEnvValues(step: EnvListAppendStep, context: EngineContext): string[] {
  return step.values.map((value) => render(value, context))
}

// ── Checks: simulate each step on the overlay, report problems through `fail` ──

type Fail = (problem: string) => void

function checkCopyStep(
  step: CopyStep,
  context: EngineContext,
  overlay: FileOverlay,
  fail: Fail,
): void {
  const post = step.phase === 'post'
  for (const entry of planCopy(step, context, (path) => overlay.exists(path))) {
    if (!existsSync(entry.source)) {
      fail(`${toPosix(relative(context.extensionRoot, entry.source))} does not exist`)
      continue
    }
    if (post) {
      continue
    }
    const exists = overlay.exists(entry.target)
    if (exists && (step.ifExists ?? 'fail') === 'fail') {
      fail(`${entry.target} already exists`)
    } else if (!(exists && step.ifExists === 'skip')) {
      overlay.write(entry.target, readSource(entry, context).toString('utf-8'))
    }
  }
}

/** Shared by the steps that rewrite one existing file. */
function checkFileRewrite(
  file: string,
  overlay: FileOverlay,
  fail: Fail,
  rewrite: (content: string) => string,
): void {
  const content = overlay.read(file)
  if (content === null) {
    fail(`${file} does not exist`)
    return
  }
  try {
    overlay.write(file, rewrite(content))
  } catch (error) {
    fail(describeError(error))
  }
}

function checkPatchStep(
  step: PatchStep,
  context: EngineContext,
  overlay: FileOverlay,
  fail: Fail,
): void {
  if (step.phase !== 'post') {
    checkFileRewrite(renderPath(step.file, context), overlay, fail, (content) =>
      applyPatch(content, step, context),
    )
  }
}

function checkJsonMergeStep(
  step: JsonMergeStep,
  context: EngineContext,
  overlay: FileOverlay,
  fail: Fail,
): void {
  if (step.phase !== 'post') {
    checkFileRewrite(renderPath(step.file, context), overlay, fail, (content) =>
      mergeJsonFile(content, step.merge, context),
    )
  }
}

function checkEnvListAppendStep(
  step: EnvListAppendStep,
  context: EngineContext,
  overlay: FileOverlay,
  fail: Fail,
): void {
  for (const { path, optional } of listEnvFiles(step, context)) {
    const content = overlay.read(path)
    if (content === null) {
      if (!optional) {
        fail(`${path} does not exist`)
      }
      continue
    }
    try {
      const updated = appendEnvList(content, step.key, renderEnvValues(step, context))
      if (updated !== null) {
        overlay.write(path, updated)
      } else if (!optional) {
        fail(`${path} does not define ${step.key}`)
      }
    } catch (error) {
      fail(`${path} ${describeError(error)}`)
    }
  }
}

function checkGitignoreStep(
  step: GitignoreStep,
  context: EngineContext,
  overlay: FileOverlay,
): void {
  const file = renderPath(step.file, context)
  const lines = step.lines.map((line) => render(line, context))
  overlay.write(file, appendGitignore(overlay.read(file), lines, context.manifest.name))
}

function checkRunStep(step: RunStep, fail: Fail): void {
  if (!commandExists(step.command)) {
    fail(`${step.command} is not installed`)
  }
}

function checkStep(
  step: ExtensionStep,
  context: EngineContext,
  overlay: FileOverlay,
  fail: Fail,
): void {
  switch (step.type) {
    case 'copy':
      return checkCopyStep(step, context, overlay, fail)
    case 'patch':
      return checkPatchStep(step, context, overlay, fail)
    case 'json-merge':
      return checkJsonMergeStep(step, context, overlay, fail)
    case 'env-list-append':
      return checkEnvListAppendStep(step, context, overlay, fail)
    case 'gitignore':
      return checkGitignoreStep(step, context, overlay)
    case 'run':
      return checkRunStep(step, fail)
  }
}

/**
 * Runs every step on the overlay, so a `pathExists` condition sees the files
 * the previous steps create, as it will when the steps are applied.
 */
function simulateSteps(context: EngineContext): {
  labels: string[]
  issues: string[]
  overlay: FileOverlay
  commands: string[]
} {
  const overlay = createFileOverlay(context.projectRoot)
  const labels: string[] = []
  const issues: string[] = []
  const commands: string[] = []
  for (const step of context.manifest.steps) {
    const label = describeStep(step, context.variables)
    const fail: Fail = (problem) => issues.push(`${label}: ${problem}`)
    try {
      if (stepApplies(step, context, overlay)) {
        labels.push(label)
        if (step.type === 'run') {
          commands.push([step.command, ...step.args.map((arg) => render(arg, context))].join(' '))
        }
        checkStep(step, context, overlay, fail)
      }
    } catch (error) {
      fail(describeError(error))
    }
  }
  return { labels, issues, overlay, commands }
}

export interface PlannedChanges {
  added: string[]
  modified: string[]
  commands: string[]
}

/**
 * What the steps will do to this project: the files they add, the files they
 * modify, and the commands they run, in order. Files that only the commands
 * create are not listed.
 */
export function planChanges(context: EngineContext): PlannedChanges {
  const { overlay, commands } = simulateSteps(context)
  const added: string[] = []
  const modified: string[] = []
  for (const [path, content] of overlay.written()) {
    const absolute = join(context.projectRoot, path)
    if (!existsSync(absolute)) {
      added.push(path)
    } else if (content !== readFileSync(absolute, 'utf-8')) {
      modified.push(path)
    }
  }
  return { added: added.sort(), modified: modified.sort(), commands }
}

/** Labels of the steps that apply to this project, in order. */
export function listSteps(context: EngineContext): string[] {
  return simulateSteps(context).labels
}

/** Every problem the steps would hit on this project. Writes nothing. */
export function checkSteps(context: EngineContext): string[] {
  return simulateSteps(context).issues
}

// ── Apply: write through the ProjectWriter, throw on the first problem ──

function applyCopyStep(step: CopyStep, context: EngineContext, project: ProjectWriter): void {
  const exists = (path: string): boolean => existsSync(join(context.projectRoot, path))
  for (const entry of planCopy(step, context, exists)) {
    const targetExists = exists(entry.target)
    if (targetExists && step.ifExists === 'skip') {
      continue
    }
    if (targetExists && (step.ifExists ?? 'fail') === 'fail') {
      throw new Error(`${entry.target} already exists`)
    }
    project.write(entry.target, readSource(entry, context))
  }
}

function applyFileRewrite(
  file: string,
  project: ProjectWriter,
  rewrite: (content: string) => string,
): void {
  const content = project.read(file)
  if (content === null) {
    throw new Error(`${file} does not exist`)
  }
  project.write(file, rewrite(content))
}

function applyEnvListAppendStep(
  step: EnvListAppendStep,
  context: EngineContext,
  project: ProjectWriter,
): void {
  for (const { path, optional } of listEnvFiles(step, context)) {
    const content = project.read(path)
    const updated =
      content === null ? null : appendEnvList(content, step.key, renderEnvValues(step, context))
    if (updated === null) {
      if (!optional) {
        throw new Error(`${path} does not define ${step.key}`)
      }
    } else if (updated !== content) {
      project.write(path, updated)
    }
  }
}

function applyGitignoreStep(
  step: GitignoreStep,
  context: EngineContext,
  project: ProjectWriter,
): void {
  const file = renderPath(step.file, context)
  const content = project.read(file)
  const lines = step.lines.map((line) => render(line, context))
  const updated = appendGitignore(content, lines, context.manifest.name)
  if (updated !== content) {
    project.write(file, updated)
  }
}

function applyRunStep(step: RunStep, context: EngineContext, project: ProjectWriter): void {
  for (const path of step.creates ?? []) {
    project.expect(renderPath(path, context))
  }
  const result = spawnProcessSync(
    step.command,
    step.args.map((arg) => render(arg, context)),
    {
      cwd: join(context.projectRoot, renderPath(step.cwd ?? '.', context)),
      stdio: ['ignore', 'inherit', 'inherit'],
    },
  )
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0 && !step.allowFailure) {
    const hint = step.failureHint ? `\n  ${render(step.failureHint, context)}` : ''
    throw new Error(`exit code ${result.status} (see the output above)${hint}`)
  }
}

function applyStep(step: ExtensionStep, context: EngineContext, project: ProjectWriter): void {
  switch (step.type) {
    case 'copy':
      return applyCopyStep(step, context, project)
    case 'patch':
      return applyFileRewrite(renderPath(step.file, context), project, (content) =>
        applyPatch(content, step, context),
      )
    case 'json-merge':
      return applyFileRewrite(renderPath(step.file, context), project, (content) =>
        mergeJsonFile(content, step.merge, context),
      )
    case 'env-list-append':
      return applyEnvListAppendStep(step, context, project)
    case 'gitignore':
      return applyGitignoreStep(step, context, project)
    case 'run':
      return applyRunStep(step, context, project)
  }
}

/** Writes to the project, keeping what is needed to put it back as it was. */
function createProjectWriter(root: string): ProjectWriter & {
  changedFiles: () => string[]
  /** Returns what could not be restored, so the error that caused the rollback stays visible. */
  rollback: (gitRollback: boolean) => string[]
} {
  const originals = new Map<string, Buffer | null>()
  const createdPaths: string[] = []

  return {
    read: (path) => {
      const absolute = join(root, path)
      return existsSync(absolute) ? readFileSync(absolute, 'utf-8') : null
    },
    write: (path, content) => {
      if (!originals.has(path)) {
        const absolute = join(root, path)
        originals.set(path, existsSync(absolute) ? readFileSync(absolute) : null)
      }
      const created = mkdirSync(dirname(join(root, path)), { recursive: true })
      if (created) {
        createdPaths.push(created)
      }
      writeFileSync(join(root, path), content)
    },
    expect: (path) => {
      const absolute = join(root, path)
      if (!existsSync(absolute)) {
        createdPaths.push(absolute)
      }
    },
    changedFiles: () => [...originals.keys()],
    rollback: (gitRollback) => {
      const problems: string[] = []
      const attempt = (action: () => void): void => {
        try {
          action()
        } catch (error) {
          problems.push(describeError(error))
        }
      }
      for (const [path, original] of [...originals].reverse()) {
        attempt(() =>
          original === null
            ? rmSync(join(root, path), { force: true })
            : writeFileSync(join(root, path), original),
        )
      }
      for (const path of [...createdPaths].reverse()) {
        attempt(() => rmSync(path, { recursive: true, force: true }))
      }
      if (gitRollback) {
        attempt(() => runGit(['checkout', '--', '.'], root))
        attempt(() => runGit(['clean', '-fd', '--quiet'], root))
      }
      return problems
    },
  }
}

/**
 * Applies the steps, then `record`; on failure restores the project and throws
 * a StepFailedError.
 */
export function applySteps(context: EngineContext, options: ApplyOptions): ApplyResult {
  const project = createProjectWriter(context.projectRoot)
  const runOrRollBack = (action: () => void, failure: string): void => {
    try {
      action()
    } catch (error) {
      const problems = project.rollback(options.gitRollback === true)
      const restore =
        problems.length > 0
          ? `\n  The project could not be fully restored: ${problems.join('; ')}`
          : '\n  Every change was rolled back.'
      throw new StepFailedError(`${failure}: ${describeError(error)}${restore}`, { cause: error })
    }
  }

  for (const step of context.manifest.steps) {
    const label = describeStep(step, context.variables)
    runOrRollBack(() => {
      if (stepApplies(step, context)) {
        options.log(label)
        applyStep(step, context, project)
      }
    }, `Step '${label}' failed`)
  }
  if (options.record) {
    runOrRollBack(options.record, 'Recording the installation failed')
  }
  return { changedFiles: project.changedFiles() }
}
