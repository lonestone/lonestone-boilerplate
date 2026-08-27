---
id: v1.1.0/adopt-conventional-commits
domain: ci
classification: migration
---

# Adopt Conventional Commits

## Goal

The project writes Conventional Commits, lints them locally with lefthook and commitlint, lints pull request title and description in CI, and squash-merges so the pull request title plus description become the commit that lands on `main`.

## Why

The squash commit is the only hand-written record that survives the merge. Everything else — changelog lines, version math, `git show` — is derived from it. Without a shared format, a local hook, and a CI check that treats the title and description as that future commit, agents invent their own wording, leftover WIP subjects land in history, and later generated changelogs have nothing clean to parse.

`CONTRIBUTING.md` stays the shared convention (do not fork the prose to list types or scopes). Scopes are edited in `commitlint.config.ts` only.

Projects still on Husky should switch. Lefthook is one config file; its package installs hooks on a local `pnpm install`. After leaving Husky, run `pnpm exec lefthook install --reset-hooks-path` once so git drops `core.hooksPath` pointing at `.husky/_`. Two hook systems must not run at once.

## Applies When

- The project tracks the `ci` domain.
- Any of these is missing or still on the old stack: `commitlint.config.ts`, `lefthook.yml`, `CONTRIBUTING.md`, `.github/workflows/pr-lint.yml`, `scripts/lint-pr.ts`, or the `lint:pr` root script. Still using Husky is the normal starting state this intention migrates away from.

## Do Not Apply When

- A human has explicitly decided to keep their own commit or pull-request convention after reviewing this intention — record as skipped with that reason. Still using Husky, or not having commitlint yet, is **not** a skip condition.

## Observable Gaps

Work through each gap independently; skip any that is already closed.

1. **Commitlint** — signal: no `commitlint.config.ts` at the repo root, or root `package.json` is missing `@commitlint/cli` / `@commitlint/config-conventional` (and the `lint` / `load` / `types` packages the PR linter imports).
   Copy the staged reference `commitlint.config.ts`, then edit only the `SCOPES` array to match the domains this project actually tracks. Do not copy the type or scope lists into docs, skills, or workflows.
   Align those `@commitlint/*` versions with the staged reference `package.json`. Touch no other dependency in this gap.
   Done when: `echo "feat(ci): test" | pnpm exec commitlint` exits 0, and a message with an unknown scope fails.

2. **Lefthook replaces Husky** — signal: no `lefthook.yml`, `husky` is still in `devDependencies`, `.husky/` still exists, `prepare` still runs `husky`, or `prepare` still runs `lefthook install`.
   Copy then adapt the staged reference `lefthook.yml` (keep project-specific hook jobs; keep the `commit-msg` commitlint job). Add `lefthook` from the staged reference `package.json`. Remove `husky` and delete `.husky/` so only lefthook runs. Do not add a `prepare` script — the lefthook package installs hooks on `pnpm install`. After leaving Husky, run `pnpm exec lefthook install --reset-hooks-path` once so git drops `core.hooksPath` pointing at `.husky/_`. If `prepare` only existed to run husky or lefthook install, delete it.
   Done when: `lefthook.yml` exists, `.husky/` is gone, root `package.json` has no `husky` dependency and no `prepare` that calls husky or lefthook, and `pnpm exec lefthook install --reset-hooks-path` exits 0.

3. **Written convention and finalize skill** — signal: no `CONTRIBUTING.md` at the repo root, or `.claude/skills/finalize-pr/SKILL.md` / `.cursor/skills/finalize-pr/SKILL.md` are missing.
   Copy the staged reference `CONTRIBUTING.md` verbatim. Copy both finalize-pr skill files verbatim. Do not rewrite the convention in AGENTS.md, CLAUDE.md, or editor rules — a one-line pointer to `CONTRIBUTING.md` is enough if those files already exist.
   Done when: the three files match the staged references.

4. **PR title and description lint** — signal: no `.github/workflows/pr-lint.yml`, no `scripts/lint-pr.ts`, no `scripts/tsconfig.json`, or root `package.json` has no `lint:pr` script.
   Copy `scripts/lint-pr.ts` and `scripts/tsconfig.json` from the staged references. Add the `lint:pr` script from the staged reference `package.json` (`tsx ./scripts/lint-pr.ts`). Adapt `.github/workflows/pr-lint.yml` only if the project's Node/pnpm setup action path differs; otherwise copy it.
   Done when: `pnpm exec tsc -p scripts/tsconfig.json` passes, `package.json` has `lint:pr`, and the workflow file exists.

5. **GitHub squash settings** — signal: `scripts/github-repo-settings.md` or `scripts/configure-github-repo.sh` is missing, or the GitHub repo still allows merge commits / rebase, or the default squash message is not "Pull request title and description".
   Copy both staged reference files. Run `./scripts/configure-github-repo.sh` (dry run), then `--apply` after a human agrees. On a consumer repo, skip creating the `no-intention` label — that gate is boilerplate-producer only.
   Done when: the two files exist, and the repo's merge settings are squash-only with title plus description as the squash message.

## Out of Scope

- release-please, a generated `CHANGELOG.md`, release notes in the docs app, and tag-triggered GHCR images — those are `unreleased/adopt-release-please`.
- The intention-gate workflow, `.boilerstone/migration-intentions/unreleased/`, and the `boilerstone-intention` and `boilerstone-release` skills — producer only.
- Rewriting unrelated root scripts or dependencies.
- Lockfiles (`pnpm-lock.yaml`) and generated artifacts.

## Reference Paths

- `commitlint.config.ts` — **adapt**
- `lefthook.yml` — **adapt**
- `CONTRIBUTING.md` — **copy**
- `.github/workflows/pr-lint.yml` — **adapt**
- `scripts/lint-pr.ts` — **copy**
- `scripts/tsconfig.json` — **copy**
- `scripts/github-repo-settings.md` — **copy**
- `scripts/configure-github-repo.sh` — **copy**
- `.claude/skills/finalize-pr/SKILL.md` — **copy**
- `.cursor/skills/finalize-pr/SKILL.md` — **copy**
- `package.json` — **adapt**

## Validation

- `pnpm install` completes if dependencies changed.
- `echo "feat(ci): test" | pnpm exec commitlint` exits 0.
- `pnpm exec lefthook install --reset-hooks-path` exits 0.
- Root `package.json` has no `prepare` that calls husky or lefthook.
- `pnpm exec tsc -p scripts/tsconfig.json` passes.
- Husky is gone: no `.husky/` directory and no `husky` entry in root `package.json`.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/adopt-conventional-commits --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
