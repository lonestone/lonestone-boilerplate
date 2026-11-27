---
id: unreleased/clean-release-bot-runs
domain: ci
classification: migration
---

# Clean the pending runs of the release bot

## Goal

`.github/workflows/release-please.yml` has a `clean-bot-runs` job that deletes the held runs of `github-actions[bot]` on the Release PR branch after each bot push.

## Why

release-please pushes the Release PR with `GITHUB_TOKEN`. GitHub holds the `pull_request` runs of that push in `action_required`, with no job. When the PR merges, they turn into failures. Every release sends one false failure mail per workflow. Deleting the held runs removes the mails. Runs from a human push are untouched, so the checks still gate the merge.

## Applies When

- `.github/workflows/release-please.yml` exists and runs `googleapis/release-please-action`.
- The project merges Release PRs and gets failure mails for runs with `action_required` and no job.

## Do Not Apply When

- release-please pushes with a personal access token or a GitHub App token. Those pushes start their runs normally.
- A human decided to keep the held runs.

## Observable Gaps

1. **Job missing** — signal: no `clean-bot-runs` job in `.github/workflows/release-please.yml`.
   Copy the job from the staged reference.
   Done when: the job exists, with `permissions: actions: write` and `continue-on-error: true` on its step.
2. **Outputs missing** — signal: the `release-please` job has no `prs_created` and `pr` outputs.
   Add both, as in the staged reference.
   Done when: `clean-bot-runs` reads `needs.release-please.outputs.pr` and `prs_created`.

## Out of Scope

- How the release is made: tokens, the tag, the images, the publish job.
- The other jobs of `release-please.yml`.

## Reference Paths

- `.github/workflows/release-please.yml` — **adapt** (keep the project's own jobs and runner labels)

## Validation

- `actionlint` passes on `.github/workflows/release-please.yml`, if installed.
- After the next Release PR push by the bot, `gh run list --status action_required` shows no run of `github-actions[bot]` on the release branch.

## Record Result

Run `pnpm boilerplate upgrade record --id vX.Y.Z/clean-release-bot-runs --applied`
