---
id: v1.0.0/adopt-knip
domain: tooling
classification: migration
---

# Adopt Knip

## Goal

The project runs Knip for unused-file and unused-dependency detection via a root `knip` script, a committed `knip.json`, and a CI job that executes `pnpm knip`.

## Why

The v1.0.0 boilerplate uses Knip as a soft gate (`knip --no-exit-code`) so dead exports and orphaned deps surface in CI without blocking the build. Projects without it accumulate unused surface area that later upgrades cannot see.

## Applies When

- The project tracks the `tooling` domain.
- The root `package.json` lacks a `knip` script, `knip` is missing from root `devDependencies`, `knip.json` is absent, or CI does not run `pnpm knip`.

## Do Not Apply When

- A human has explicitly decided not to adopt Knip after reviewing this intention — record as skipped with that reason. Not having Knip yet is **not** a skip condition.
- The project already runs an equivalent unused-code tool the team wants to keep instead of Knip (stop and ask which tool wins).

## Observable Gaps

Work through each gap independently; skip any that is already closed.

1. **Script and dependency** — signal: root `package.json` has no `knip` script, or `knip` is missing from root `devDependencies`.
   Align the `knip` script and `knip` version with the staged reference `package.json`. Keep every project-specific script untouched.
   Done when: `pnpm knip` runs from the repo root.

2. **Config** — signal: no `knip.json` at the project root.
   Copy the staged reference `knip.json`, then adapt workspace `entry` / `ignoreDependencies` / `ignoreFiles` to the project's real apps and packages. Do not invent entries for apps the project does not have.
   Done when: `pnpm knip` completes without unresolved workspace/config errors, and every delta against the staged reference is a named project adjustment.

3. **CI job** — signal: `.github/workflows/ci.yml` (or the project's equivalent workflow) has no job that runs `pnpm knip`.
   Port the Knip job from the staged reference CI workflow (setup restore + `pnpm knip`). Do not rewrite unrelated jobs, deploy workflows, or project-specific checks.
   Done when: the workflow file contains a Knip job equivalent to the reference, and a dry review of the YAML shows no accidental edits to other jobs.

## Out of Scope

- Fixing or deleting unused files/exports/dependencies that Knip reports — triage is the project's call; this intention only wires the tool.
- Non-CI local hooks (Husky, lefthook, etc.).
- Other CI jobs (lint, build, typecheck, deploy).

## Reference Paths

- `package.json` — **adapt**
- `knip.json` — **adapt**
- `.github/workflows/ci.yml` — **adapt**

## Validation

- `pnpm install` completes if dependencies changed.
- `pnpm knip` runs (findings may warn; exit policy follows the script, typically `--no-exit-code`).
- CI workflow includes a Knip job when the project uses GitHub Actions.

## Record Result

Run `pnpm boilerplate upgrade record --id v1.0.0/adopt-knip --applied` after validation passes, or record it as skipped with a reason.
