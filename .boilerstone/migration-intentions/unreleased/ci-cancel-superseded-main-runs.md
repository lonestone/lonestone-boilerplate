---
id: unreleased/ci-cancel-superseded-main-runs
domain: ci
classification: migration
---

# Cancel the CI run on main when a newer push arrives

## Goal

A new push to `main` cancels the CI run of `main` that is still going. When several merges follow each other, only the run for the last commit finishes.

## Why

Each push to `main` had its own concurrency group, so no run on `main` was ever cancelled. Merges in a row each ran a full CI that a later merge made out of date, and GitHub bills every job in whole minutes.

## Applies When

- The project tracks the `ci` domain.
- `.github/workflows/ci.yml` has a `concurrency` block whose group ends in `github.sha`, or whose `cancel-in-progress` depends on `github.event_name`.

## Do Not Apply When

- `.boilerstone/migration-intentions/` exists. This is the boilerplate repository, or a fork that publishes its own intentions. Record as skipped.
- Something needs a finished CI run for every commit on `main`, for example a `workflow_run` trigger on the CI workflow, or a deploy that waits for it. Record as skipped with that reason.

## Observable Gaps

1. **Runs on main are never cancelled** — signal: `rg "github.sha|github.event_name == 'pull_request'" .github/workflows/ci.yml` matches in the `concurrency` block.
   Set `group: ci-${{ github.event.pull_request.number || github.ref }}` and `cancel-in-progress: true`. Update the comment above the block to say that a new push to `main` cancels the run of `main` that is still going.
   Done when: the `concurrency` block of `.github/workflows/ci.yml` matches the reference.

## Out of Scope

- The draft pull request rule and the PR lint concurrency. `ci-skip-draft-pull-requests` covers them.
- Branch protection and required checks. Only a human changes them.

## Reference Paths

- `.github/workflows/ci.yml` — **adapt**

## Validation

- `rg "cancel-in-progress: true" .github/workflows/ci.yml` matches.
- Merge two pull requests in a row: the CI run of the first merge shows as cancelled, and the run of the second finishes.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/ci-cancel-superseded-main-runs --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
