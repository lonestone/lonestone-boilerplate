---
id: unreleased/drop-producer-only-workflows
domain: ci
classification: migration
---

# Drop the boilerplate-only intention workflows and checks

## Goal

The project has no `Intention gate` or `Intention promote` workflow, neither check is required on the default branch, the `no-intention` label is not part of its repository script and settings doc, and `ci.yml` has no release-tag fixture step.

## Why

Both workflows belong to the boilerplate repository, the only place that has `.boilerstone/migration-intentions/` (see "Producer or consumer" in `.boilerstone/README.md`). `init` in v1.2.0 left them in generated projects. There, `Intention gate` fails on every pull request: it asks for a new file under a directory that the project cannot have, and its only way out is a `no-intention` label that `scripts/configure-github-repo.sh --apply` creates. Worse, `scripts/github-repo-settings.md` told people to make both checks required, which blocks every merge once branch protection is on.

The same goes for the `Ensure local v1.0.0 release tag` step in `ci.yml`: it exists so the boilerplate's own CLI tests can find a release tag, and does nothing for a project.

## Applies When

- The project tracks the `ci` domain.
- `.github/workflows/intention-gate.yml` or `.github/workflows/intention-promote.yml` exists.
- Or `scripts/configure-github-repo.sh` or `scripts/github-repo-settings.md` mentions `no-intention`, `Intention gate` or `Intention promote`.
- Or `.github/workflows/ci.yml` has the step `Ensure local v1.0.0 release tag`.

## Do Not Apply When

- `.boilerstone/migration-intentions/` exists. This is the boilerplate repository, or a fork that publishes its own intentions. Record as skipped.
- A human has explicitly decided to keep the intention checks for their own use after reviewing this intention. Record as skipped with that reason.

## Observable Gaps

Work through the gaps in this order. Gap 1 must be closed before gap 2.

1. **Required checks** — signal: branch protection or a ruleset on the default branch requires `Intention gate` or `Intention promote`. For classic protection, `gh api repos/{owner}/{repo}/branches/main/protection/required_status_checks --jq .contexts` lists them (a 404 means there is none). Rulesets are only visible in the GitHub UI.
   Do not change repository settings yourself. Tell a human to remove both names from the required checks first. Once the workflows are deleted, a required check never reports and every pull request waits for it forever.
   Done when: neither name is required, or a human confirmed that no protection exists (it is not available on a private repository on the free plan).

2. **Workflows** — signal: `.github/workflows/intention-gate.yml` or `.github/workflows/intention-promote.yml` exists.
   Delete both files. Do not replace them.
   Done when: neither file exists.

3. **Repository script and settings doc** — signal: `rg "no-intention|Intention gate|Intention promote" scripts` matches.
   In the staged references, the lines between `boilerstone:producer-only:begin` and `boilerstone:producer-only:end` are the boilerplate-only parts. Drop the same parts from the project's copies: the `no-intention` label step and its help text, the two required-check entries, and the label section of the settings doc. Keep every project-specific change, and do not copy the marker lines.
   Done when: the `rg` command above returns nothing and `bash -n scripts/configure-github-repo.sh` passes.

4. **Release-tag fixture** — signal: `.github/workflows/ci.yml` has the step `Ensure local v1.0.0 release tag`.
   Delete that step and the two comment lines above it.
   Done when: `rg "Ensure local v1.0.0" .github/workflows/ci.yml` returns nothing.

## Out of Scope

- Creating or changing branch protection or rulesets. Only a human removes the two names.
- Deleting the `no-intention` label from the repository. A human can run `gh label delete no-intention` if they want to.
- `release-note.yml`, `release-please.yml`, `promote.yml`, `promote-on-release.yml` and `push-to-ghcr.yml`. They are consumer workflows. The `publish-cli` job in `release-please.yml` is skipped outside the boilerplate repository: leave it.
- The `finalize-pr` and `project-release` skills. Their boilerplate-only steps only fire when `.boilerstone/migration-intentions/` exists, which this project does not have.

## Reference Paths

- `scripts/configure-github-repo.sh` — **adapt**
- `scripts/github-repo-settings.md` — **adapt**
- `.github/workflows/ci.yml` — **adapt**

## Validation

- `ls .github/workflows/intention-gate.yml .github/workflows/intention-promote.yml` finds neither file.
- `rg "no-intention|Intention gate|Intention promote" .github scripts` returns nothing.
- `bash -n scripts/configure-github-repo.sh` passes, and `./scripts/configure-github-repo.sh` (dry run) changes nothing.
- A human confirmed that the required checks on the default branch no longer name the two checks.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/drop-producer-only-workflows --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
