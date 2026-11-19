---
id: unreleased/ci-fmt-check-quiet-hooks
domain: tooling
classification: migration
---

# Check formatting in CI and quiet the git hooks

## Goal

CI fails when files are not formatted, and the lefthook hooks print only failures, without colors.

## Why

CI ran `pnpm lint` (Oxlint), which does not check formatting. A project could stay red on `pnpm fmt:check` for weeks while CI was green. One downstream project reached about fifty unformatted files on `main` this way. CI now runs `pnpm fmt:check` right after `pnpm lint`.

The pre-push hook also printed all of its lint output, with ANSI colors, on every push attempt. AI agents read that output, so it filled their context with noise. The hooks now print only when a job fails, and without colors.

`CHANGELOG.md` is ignored by Oxfmt. Release-please rewrites it on every release, so formatting it would turn every Release PR red.

## Applies When

- The project tracks the `tooling` domain.
- `.github/workflows/ci.yml` has a `lint` job that runs `pnpm lint`.
- `pnpm fmt:check` exists in the root `package.json`.

## Do Not Apply When

- The project has deliberately left Oxfmt and has no `fmt:check` script.
- A human has decided to keep formatting out of CI after reviewing this intention.

## Observable Gaps

1. **Format check in CI** — signal: the `lint` job in `.github/workflows/ci.yml` has no step that runs `pnpm fmt:check`.
   Add the step right after `Run linter`, as in the staged reference. Touch no other step.
   Done when: `rg "pnpm fmt:check" .github/workflows/ci.yml` matches.

2. **Unformatted files** — signal: `pnpm fmt:check` fails on the project.
   Run `pnpm fmt` and commit the result on its own, before the CI change, so CI stays green. Do not change the Oxfmt rules to make files pass.
   Done when: `pnpm fmt:check` passes.

3. **Generated changelog** — signal: `.oxfmtrc.json` does not ignore `CHANGELOG.md`.
   Add `CHANGELOG.md` to `ignorePatterns`. Keep the project's other patterns.
   Done when: `pnpm fmt:check` ignores `CHANGELOG.md`.

4. **Quiet hooks** — signal: `lefthook.yml` has no top-level `output: [failure]` and `colors: false`, or its jobs do not set `NO_COLOR`.
   Add both top-level settings and the `NO_COLOR: '1'` and `FORCE_COLOR: '0'` env on every job, as in the staged reference. Keep the project's own jobs and commands as they are.
   Done when: `git push --dry-run` with a passing tree prints no lefthook output, and a failing job still prints its error.

5. **Documentation** — signal: `.github/ACTIONS.md` lists the lint job without `pnpm fmt:check`.
   Add one line for the format check under the lint job.
   Done when: `rg "fmt:check" .github/ACTIONS.md` matches.

## Out of Scope

- The commands the hooks run, and the lint and format rules.
- Other CI jobs and steps.
- Warnings that Oxlint already reports.

## Reference Paths

- `.github/workflows/ci.yml` — **adapt**
- `lefthook.yml` — **adapt**
- `.oxfmtrc.json` — **adapt**
- `.github/ACTIONS.md` — **adapt**

## Validation

- `pnpm fmt:check` passes.
- `pnpm lint` passes.
- A pull request runs the `lint` job with the new step and it is green.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/ci-fmt-check-quiet-hooks --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
