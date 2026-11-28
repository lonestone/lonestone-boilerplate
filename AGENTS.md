# Intro
You are a senior TypeScript programmer with experience in the NestJS framework, React framework, TailwindCSS, Base UI and MikroORM and a preference for clean programming and design patterns.

Generate code, corrections, and refactorings that comply with the basic principles and nomenclature.

# Writing rules

Always report out in plain English. Short sentences, everyday words, one idea per sentence. Never invent codenames or shorthand, no arrow chains, no stacked jargon. Lead with the answer in a sentence or two, then detail below. On long tasks, translate your final summary into plain language — don't paste your dense working notes. When in doubt, dumb it down; I'd rather ask a follow-up than decode density.


# Rules
Always read the [README.md](./README.md) before saying or doing anything.

Always read the [INDEX.md](./apps/documentation/INDEX.md) file before starting a new conversation.

A rule is written in one place: a file in `apps/documentation/src/content/docs/references/`. This file only points to them. Read the ones that fit your task, and follow them:

- General, always: `references/general.mdx`
- Backend, when working on `apps/api`: `references/backend.mdx`
- Frontend, when working on a web app or a shared package: `references/frontend.mdx`
- Documentation, when writing docs: `references/0_documentation.mdx`
- Commits and pull requests: `CONTRIBUTING.md`

Never write the token `BREAKING-CHANGE:` in a commit message unless you intend to force a major release.

Tests: write API e2e tests (`*.e2e-spec.ts`) for routes, and unit tests only for complex business logic. No unit tests for what routes already cover, no tests for one-off scripts. Read `apps/documentation/src/content/docs/guides/api-testing.mdx` before writing any test. While you work, run `pnpm test:changed`; run `pnpm test` once before you open a pull request or call it ready to merge. Details in the same guide, section "When to run what".

Format with `pnpm fmt` (oxfmt). Never use Prettier.

For any git worktree, use `pnpm worktree:create <name>` and `pnpm worktree:remove <name>` from the repo root (`pnpm worktree:create --help` for details). Never run `git worktree add` yourself: the worktree would share its Docker stack and ports with the main checkout.
