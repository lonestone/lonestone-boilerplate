import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import lint from '@commitlint/lint'
import load from '@commitlint/load'
import type { QualifiedConfig } from '@commitlint/types'
import { TYPES, WIP_TRAILING_PATTERNS, WIP_WORDS } from '../commitlint.config.ts'

const TITLE_FIX =
  'the title becomes the squash subject — write it as `type(scope): description`; valid scopes live in commitlint.config.ts'

const DESCRIPTION_FIX =
  'the description becomes the commit body verbatim — rationale prose + valid conventional paragraphs only; move screenshots/checklists to comments'

function formatWipFix(word: string): string {
  return `'${word}' would land in the changelog — finalize the PR: rewrite the title/paragraph to describe the result`
}

const BREAKING_CHANGE_TOKEN = 'BREAKING-CHANGE:'

const IMAGE_PATTERN = new RegExp('!\\[[^\\]]*\\]\\([^)]+\\)|<img[\\s>]', 'iu')
const TASK_LIST_PATTERN = /^\s*[-*+]\s+\[[ xX]\]/mu

const CONVENTIONAL_HEADER_PATTERN = new RegExp(`^(?:${TYPES.join('|')})(?:\\([^)]+\\))?!?:\\s`, 'u')

interface PullRequestPayload {
  title: string
  body: string | null
  draft: boolean
}

interface GitHubPullRequestEvent {
  pull_request?: PullRequestPayload
}

interface LintIssue {
  prompt: string
  details: string[]
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === ''
}

function splitParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/u)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '')
}

function getFirstLine(paragraph: string): string {
  const [firstLine] = paragraph.split('\n')
  return firstLine ?? ''
}

function isConventionalParagraph(paragraph: string): boolean {
  return CONVENTIONAL_HEADER_PATTERN.test(getFirstLine(paragraph))
}

function getSubjectDescription(header: string): string {
  return header.replace(/^[a-z]+(?:\([^)]+\))?!?:\s*/u, '').trim()
}

function findWipHits(text: string): string[] {
  const hits: string[] = []
  const description = getSubjectDescription(text)
  const firstWord = description.split(/\s+/u)[0]?.toLowerCase() ?? ''

  for (const word of WIP_WORDS) {
    if (word.includes(' ')) {
      const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'iu')
      if (pattern.test(description)) {
        hits.push(word)
      }
      continue
    }

    const isStandaloneLeftover =
      description.toLowerCase() === word || firstWord === word.toLowerCase()
    if (isStandaloneLeftover) {
      hits.push(word)
    }
  }

  for (const { label, pattern } of WIP_TRAILING_PATTERNS) {
    if (pattern.test(description)) {
      hits.push(label)
    }
  }

  return hits
}

function findNonCommitContent(body: string): string[] {
  const found: string[] = []
  if (IMAGE_PATTERN.test(body)) {
    found.push('markdown/HTML image')
  }
  if (TASK_LIST_PATTERN.test(body)) {
    found.push('task list')
  }
  return found
}

function containsBreakingChangeToken(text: string): boolean {
  return text.includes(BREAKING_CHANGE_TOKEN)
}

function resolveEventPath(): string {
  const fromArg = process.argv[2]
  if (fromArg !== undefined && fromArg !== '') {
    return resolve(fromArg)
  }

  const fromEnv = process.env.GITHUB_EVENT_PATH
  if (fromEnv !== undefined && fromEnv !== '') {
    return fromEnv
  }

  throw new Error('Set GITHUB_EVENT_PATH or pass a path to the GitHub event JSON.')
}

function readPullRequest(eventPath: string): PullRequestPayload {
  const raw = readFileSync(eventPath, 'utf8')
  const event = JSON.parse(raw) as GitHubPullRequestEvent
  if (event.pull_request === undefined) {
    throw new Error(`No pull_request in event payload at ${eventPath}`)
  }
  return event.pull_request
}

function getLintOptions(config: QualifiedConfig): { parserOpts?: object } {
  const parserOpts = config.parserPreset?.parserOpts
  if (parserOpts === undefined || parserOpts === null) {
    return {}
  }
  if (typeof parserOpts !== 'object') {
    return {}
  }
  return { parserOpts }
}

async function lintCommitMessage(
  message: string,
  config: QualifiedConfig,
): Promise<{ valid: boolean; details: string[] }> {
  const report = await lint(message, config.rules, getLintOptions(config))
  if (report.valid) {
    return { valid: true, details: [] }
  }

  const details = report.errors.map((error) => `${error.name}: ${error.message}`)
  return { valid: false, details }
}

async function collectIssues(
  pullRequest: PullRequestPayload,
  config: QualifiedConfig,
): Promise<LintIssue[]> {
  const issues: LintIssue[] = []
  const title = pullRequest.title ?? ''
  const body = pullRequest.body ?? ''
  const isDraft = pullRequest.draft === true

  if (!isBlank(title)) {
    const titleLint = await lintCommitMessage(title, config)
    if (!titleLint.valid) {
      issues.push({ prompt: TITLE_FIX, details: titleLint.details })
    }
  } else {
    issues.push({
      prompt: TITLE_FIX,
      details: ['title is empty'],
    })
  }

  if (containsBreakingChangeToken(title) || containsBreakingChangeToken(body)) {
    issues.push({
      prompt:
        'Never write the token `BREAKING-CHANGE:` unless you intend to force a major release. If you do, use `type(scope)!: description` in the title instead.',
      details: [`found ${BREAKING_CHANGE_TOKEN}`],
    })
  }

  if (isBlank(body)) {
    if (!isDraft) {
      issues.push({
        prompt: DESCRIPTION_FIX,
        details: ['description is empty; non-draft PRs must describe the future commit body'],
      })
    }
    if (!isDraft && !isBlank(title)) {
      for (const word of findWipHits(title)) {
        issues.push({ prompt: formatWipFix(word), details: [`title: ${title}`] })
      }
    }
    return issues
  }

  const nonCommitContent = findNonCommitContent(body)
  if (nonCommitContent.length > 0) {
    issues.push({
      prompt: DESCRIPTION_FIX,
      details: nonCommitContent.map((item) => `found ${item}`),
    })
  }

  const paragraphs = splitParagraphs(body)
  const conventionalParagraphs = paragraphs.filter(isConventionalParagraph)

  for (const paragraph of conventionalParagraphs) {
    const paragraphLint = await lintCommitMessage(getFirstLine(paragraph), config)
    if (!paragraphLint.valid) {
      issues.push({
        prompt: DESCRIPTION_FIX,
        details: [
          `invalid conventional paragraph: ${getFirstLine(paragraph)}`,
          ...paragraphLint.details,
        ],
      })
    }
  }

  if (!isDraft) {
    const changelogStrings = [title, ...conventionalParagraphs.map(getFirstLine)]
    for (const entry of changelogStrings) {
      for (const word of findWipHits(entry)) {
        issues.push({
          prompt: formatWipFix(word),
          details: [entry],
        })
      }
    }
  }

  return issues
}

function printIssues(issues: LintIssue[]): void {
  process.stderr.write('PR lint failed.\n\n')
  for (const issue of issues) {
    process.stderr.write(`• ${issue.prompt}\n`)
    for (const detail of issue.details) {
      process.stderr.write(`  ${detail}\n`)
    }
    process.stderr.write('\n')
  }
}

async function main(): Promise<void> {
  const eventPath = resolveEventPath()
  const pullRequest = readPullRequest(eventPath)
  const config = await load()
  const issues = await collectIssues(pullRequest, config)

  if (issues.length === 0) {
    process.stdout.write('PR title and description are commit-clean.\n')
    return
  }

  printIssues(issues)
  process.exitCode = 1
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
