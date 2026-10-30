---
id: unreleased/ci-skip-draft-pull-requests
domain: ci
classification: migration
---

# Stop billing CI runs on draft pull requests and on superseded pushes

## Goal

A draft pull request gets no CI run, a new push cancels the CI run of the previous push, the PR lint runs cancel each other, and the Release note job starts a runner only on a Release PR.

## Why

GitHub bills each job in whole minutes, and a private repository has a monthly allowance. A branch that is pushed often, for example one commit per phase of a feature, started a full CI run on every push, and each run kept going after the next push made it useless. One project used its whole allowance in two weeks this way. The Release note job also started a runner on every pull request just to find out that it was not a Release PR.

## Applies When

- The project tracks the `ci` domain.
- `.github/workflows/ci.yml` runs on `pull_request` and has no `pull_request.draft` condition.
- Or `.github/workflows/ci.yml` has no `concurrency` block.
- Or `.github/workflows/pr-lint.yml` has no `concurrency` block.
- Or the job in `.github/workflows/release-note.yml` has no `if` on the `autorelease: pending` label.

## Do Not Apply When

- `.boilerstone/migration-intentions/` exists. This is the boilerplate repository, or a fork that publishes its own intentions. Record as skipped.
- A human has explicitly decided to run the CI on draft pull requests after reviewing this intention. Record as skipped with that reason.

## Observable Gaps

1. **Draft pull requests** — signal: `rg "pull_request.draft" .github/workflows/ci.yml` returns nothing.
   Add `types: [opened, synchronize, reopened, ready_for_review]` under `pull_request`. Without `ready_for_review`, marking a draft ready starts nothing. Put `if: github.event_name != 'pull_request' || !github.event.pull_request.draft` on the first job that every other job needs. If a job does not need it, put the same condition on that job. If the project runs one job only, put it there.
   Done when: `rg "pull_request.draft" .github/workflows/ci.yml` matches, and every job either has the condition or needs a job that has it.

2. **Superseded pushes** — signal: `rg "concurrency" .github/workflows/ci.yml` returns nothing.
   Add the `concurrency` block of the reference `ci.yml`. A pull request has one group and cancels its previous run. A push to `main` has its own group by commit, so no run on `main` is ever cancelled.
   Done when: `rg "cancel-in-progress" .github/workflows/ci.yml` matches and the value is true only for a pull request.

3. **PR lint** — signal: `rg "concurrency" .github/workflows/pr-lint.yml` returns nothing.
   Add the `concurrency` block of the reference `pr-lint.yml`. Do not touch the `types` list: a required check must report on every new commit, and the check settings doc asks for this one to be required.
   Done when: `rg "cancel-in-progress" .github/workflows/pr-lint.yml` matches.

4. **Release note** — signal: the job in `.github/workflows/release-note.yml` has no `if`.
   Add `if: "contains(github.event.pull_request.labels.*.name, 'autorelease: pending')"` on the job, and keep the gate step inside it.
   Done when: `rg "autorelease: pending" .github/workflows/release-note.yml` matches on the job.

## Out of Scope

- Merging several CI jobs into one, or skipping the tests when a pull request touches only some folders. Both depend on how the project is laid out.
- Removing `synchronize` from the PR lint `types` list. A project that has no required check can do it, but this intention does not ask for it.
- Branch protection, rulesets and required checks. Only a human changes them.

## Reference Paths

- `.github/workflows/ci.yml` — **adapt**
- `.github/workflows/pr-lint.yml` — **adapt**
- `.github/workflows/release-note.yml` — **adapt**

## Validation

- `rg "pull_request.draft" .github/workflows/ci.yml` and `rg "cancel-in-progress" .github/workflows/ci.yml .github/workflows/pr-lint.yml` all match.
- Open a draft pull request: no CI run starts. Mark it ready for review: one run starts. Push twice in a row to the ready pull request: the first run is cancelled.
- A pull request that is not a Release PR shows `Release note` as skipped.

## Record Result

Run `pnpm boilerplate upgrade record --id vX.Y.Z/ci-skip-draft-pull-requests --applied` after validation passes, or record it as skipped with a reason.
