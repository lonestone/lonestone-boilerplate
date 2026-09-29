---
id: unreleased/check-merge-settings-free-plan
domain: tooling
classification: migration
---

# Check the repository merge settings and document the free-plan limits

## Goal

The consumer repository squash-merges with the pull request title and description as the commit, and its settings docs say that required checks are advisory on a private repository on the GitHub free plan.

## Why

`CONTRIBUTING.md` relies on squash-only merges with `PR_TITLE` / `PR_BODY`. Repositories created before `scripts/configure-github-repo.sh` existed often still allow rebase and merge commits, with `COMMIT_OR_PR_TITLE` / `COMMIT_MESSAGES`: the curated title and description are then ignored at merge time. Both the boilerplate and lonestone-os were in that state.

`github-repo-settings.md` recommends protecting `main` and requiring the PR lint check. On a private repository on the free plan, branch protection and rulesets are not available, so a red PR lint does not block the merge. Teams need to know the check is not a gate there.

## Applies When

- The project has `scripts/configure-github-repo.sh` and `scripts/github-repo-settings.md`.
- The project follows `CONTRIBUTING.md` (squash merges, PR title and description as the commit).

## Do Not Apply When

- The project does not use the boilerplate contribution system.
- The project is not hosted on GitHub.

## Observable Gaps

1. **Merge settings** — signal: `gh api repos/{owner}/{repo} --jq '[.allow_merge_commit, .allow_rebase_merge, .squash_merge_commit_title, .squash_merge_commit_message]'` is not `[false,false,"PR_TITLE","PR_BODY"]`.
   Do not change repository settings yourself. Tell a human to run `./scripts/configure-github-repo.sh --apply` (it changes how the team merges, so they may want to announce it first).
   Done when: the command above prints `[false,false,"PR_TITLE","PR_BODY"]`, or a human decided to postpone it.

2. **Settings docs** — signal: `scripts/github-repo-settings.md` has no "Private repository on the GitHub free plan" paragraph.
   Add the paragraph from the staged reference before the branch-protection warning.
   Done when: the paragraph is present.

3. **Script output** — signal: `scripts/configure-github-repo.sh` does not mention the free plan in its closing "Still do in the GitHub UI" list.
   Add the two lines from the staged reference under the "Protect main" line.
   Done when: `./scripts/configure-github-repo.sh` (dry run) prints the free-plan note.

## Out of Scope

- Branch protection and rulesets themselves: never create or change them from this intention.
- Labels, GitHub Environments and Dokploy secrets handled by the script.
- `CONTRIBUTING.md` and the `finalize-pr` skill (see `unreleased/contribution-paragraphs-and-coauthors`).

## Reference Paths

- `scripts/github-repo-settings.md` — **adapt**
- `scripts/configure-github-repo.sh` — **adapt**

## Validation

- `bash -n scripts/configure-github-repo.sh` passes.
- `./scripts/configure-github-repo.sh` (dry run) changes nothing and prints the free-plan note.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/check-merge-settings-free-plan --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
