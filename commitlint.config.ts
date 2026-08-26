import { type UserConfig, RuleConfigSeverity } from '@commitlint/types'

/**
 * Conventional Commits 1.0.0 types. This is the single source of truth.
 * Do not restate this list in docs or workflows.
 */
export const TYPES = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
] as const

export type CommitType = (typeof TYPES)[number]

/**
 * Commit scopes = Boilerstone tracked domains, plus `boilerstone`.
 * Consumer projects edit this array; do not copy it into prose.
 */
export const SCOPES = [
  'tooling',
  'api',
  'frontend',
  'auth',
  'email',
  'storage',
  'monitoring',
  'ai',
  'docker-env',
  'ci',
  'boilerstone',
] as const

export type CommitScope = (typeof SCOPES)[number]

/**
 * Words that mean the PR was not finalized. Checked on the title and on
 * conventional paragraphs in the description (changelog entries), not on
 * rationale prose. A hit is a standalone leftover subject (`chore(auth): fmt`)
 * or a first-word leftover (`feat(auth): wip revocation`). Phrases such as
 * "do not merge" match anywhere in the subject description.
 */
export const WIP_WORDS = [
  'wip',
  'fixup',
  'squash',
  'tmp',
  'temp',
  'oops',
  'typo',
  'fmt',
  'lint',
  'do not merge',
  'wtf',
] as const

/**
 * Trailing leftovers of a second attempt (`… 2`, `… again`).
 * Applied to the same changelog-bound strings as `WIP_WORDS`.
 */
export const WIP_TRAILING_PATTERNS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: '2', pattern: /\s+2$/u },
  { label: 'again', pattern: /\s+again$/iu },
]

const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  helpUrl: 'See CONTRIBUTING.md. Valid types and scopes live in commitlint.config.ts.',
  rules: {
    'type-enum': [RuleConfigSeverity.Error, 'always', [...TYPES]],
    'scope-empty': [RuleConfigSeverity.Error, 'never'],
    'scope-enum': [RuleConfigSeverity.Error, 'always', [...SCOPES]],
  },
}

export default config
