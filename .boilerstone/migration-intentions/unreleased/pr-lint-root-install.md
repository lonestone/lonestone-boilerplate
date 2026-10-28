---
id: unreleased/pr-lint-root-install
domain: ci
classification: migration
requires:
  - v1.1.0/adopt-conventional-commits
pr: 194
---

# Install only the root tooling in the PR lint

## Goal

The `PR title and description` job installs only the root package, so it no longer installs every app of the monorepo.

## Why

The job only runs `scripts/lint-pr.ts`, which needs commitlint, tsx and TypeScript. Yet it ran a plain `pnpm install`, which took about 28 of its 51 seconds on every pull request event, including each edit of the title or description.

`--filter .` alone is not enough: `.npmrc` sets `node-linker=hoisted`, and the hoisted linker ignores `--filter` and installs every app anyway. Switching to the isolated linker for this one install lets the filter keep the root package: about 240 packages instead of 1,800.

A pnpm store cache in `.github/actions/setup-node-pnpm` was rejected. The other CI jobs restore `node_modules` from their own cache, so they would download the store for nothing.

## Applies When

- The project tracks the `ci` domain.
- `.github/workflows/pr-lint.yml` exists and its `Install dependencies` step runs `pnpm install` without `--filter`.

## Do Not Apply When

- The project has no `.github/workflows/pr-lint.yml`. Apply `v1.1.0/adopt-conventional-commits` first.
- The project's `scripts/lint-pr.ts`, or a file it imports, uses a package that is not a dependency of the root `package.json`. The root-only install would not provide it. Record as skipped with that reason.

## Observable Gaps

1. **Install step** — signal: the `Install dependencies` step in `.github/workflows/pr-lint.yml` runs `pnpm install` without `--filter .`.
   Replace its command with the one from the staged reference, and copy the two comment lines above it. Leave every other step as it is.
   Done when: `rg -- "--filter \. --config.node-linker=isolated" .github/workflows/pr-lint.yml` matches.

2. **Root tooling** — signal: the root `package.json` does not list `@commitlint/lint`, `@commitlint/load`, `@commitlint/types`, `tsx` or `typescript`.
   Add any missing one, at the version the project already uses elsewhere in the workspace.
   Done when: the local check in Validation passes.

## Out of Scope

- `.npmrc`. The hoisted linker stays the default for every other install.
- `.github/actions/setup-node-pnpm` and the other workflows.
- `scripts/lint-pr.ts` and `scripts/tsconfig.json`.

## Reference Paths

- `.github/workflows/pr-lint.yml` — **adapt**

## Validation

In a clean checkout (`git clean -fdx` removes every ignored file, so use a throwaway worktree):

- `pnpm install --frozen-lockfile --filter . --config.node-linker=isolated` succeeds.
- `pnpm exec tsc -p scripts/tsconfig.json` passes.
- `pnpm lint:pr` runs with a `GITHUB_EVENT_PATH` that points to a JSON file like `{"pull_request":{"title":"ci(ci): test","body":"Test."}}`, and reports the title and description as clean.
- On the next pull request, the `PR title and description` job passes.

## Record Result

Run `pnpm boilerplate upgrade record --id vX.Y.Z/pr-lint-root-install --applied` after validation passes, or record it as skipped with a reason.
