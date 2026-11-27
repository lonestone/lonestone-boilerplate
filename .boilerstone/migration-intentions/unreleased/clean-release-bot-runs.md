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

- `.github/workflows/release-please.yml` runs `googleapis/release-please-action` with `token: ${{ secrets.GITHUB_TOKEN }}`.

## Do Not Apply When

- release-please pushes with a personal access token or a GitHub App token. Those pushes start their runs normally.
- A human decided to keep the held runs.

## Observable Gaps

1. **Job missing** — signal: no `clean-bot-runs:` job in `.github/workflows/release-please.yml`.
   Adapt the job from the staged `.github/workflows/release-please.yml`, keeping the project's runner label.
   Done when: `grep -n 'clean-bot-runs:' .github/workflows/release-please.yml` finds it.
2. **Outputs missing** — signal: the `release-please` job has no `prs_created` or `pr` output.
   Add both, as in the staged `.github/workflows/release-please.yml`.
   Done when: both names appear under `outputs:` of that job.
3. **Permission and guard missing** — signal: `clean-bot-runs` has no `actions: write` permission, no `prs_created == 'true'` condition, or no `continue-on-error: true` on its step.
   Add whichever is missing, as in the staged `.github/workflows/release-please.yml`.
   Done when: `grep -c -e 'actions: write' -e "prs_created == 'true'" -e 'continue-on-error: true' .github/workflows/release-please.yml` is at least 3.

## Out of Scope

- How the release is made: tokens, the tag, the images, the publish job.
- The other jobs of `release-please.yml`.

## Reference Paths

- `.github/workflows/release-please.yml` — **adapt** (keep the project's own jobs and runner labels)

## Validation

- `grep -c 'clean-bot-runs' .github/workflows/release-please.yml` is at least 1.
- `actionlint .github/workflows/release-please.yml` passes, if installed.

## Record Result

Run `pnpm boilerplate upgrade record --id vX.Y.Z/clean-release-bot-runs --applied`
