---
id: unreleased/release-note-holds-the-tag
domain: ci
classification: migration
---

# Hold the release tag until the release note exists

## Goal

When `REQUIRE_RELEASE_NOTE` is `true`, the Release Please workflow creates no tag, no GitHub Release and no images for a Release PR merged without its note, and publishes the release once the note lands on `main`. When the variable is not set, the release is published with the notes release-please generates, without a red run.

## Why

On a private repository without GitHub Pro there is no branch protection, so the red **Release note** check did not stop anyone from merging the Release PR. A project merged two Release PRs without their notes. Release Please then created the tag and the GitHub Release first, and only failed afterwards, when it looked for the note to copy into the release. The release was out, the note was missing, and the run was red. The workflow now checks the note before release-please-action creates anything, so the guard does not depend on branch protection or on an agent remembering the `project-release` skill.

## Applies When

- The project tracks the `ci` domain.
- The project versions with release-please (`.github/workflows/release-please.yml` exists).
- `.github/scripts/release-note-gate.sh` does not exist, or `release-please.yml` has no step that runs it.

## Do Not Apply When

- `.boilerstone/migration-intentions/` exists. This is the boilerplate repository, or a fork that publishes its own intentions. Record as skipped.

## Observable Gaps

1. **Gate script** — signal: `.github/scripts/release-note-gate.sh` is missing.
   Copy `.github/scripts/release-note-gate.sh` and `.github/scripts/release-note-gate.test.sh`. The script assumes one package (the `"."` key of `.release-please-manifest.json`), tags like `vX.Y.Z`, and `python3` on the runner. If the project differs, adapt the script and its test. If the project keeps its release notes somewhere other than `apps/documentation/src/content/docs/releases/`, change that path everywhere it appears: `rg "content/docs/releases" .github`.
   Done when: `bash .github/scripts/release-note-gate.test.sh` prints `All release note gate cases pass`.

2. **Release Please workflow** — signal: `rg "release-note-gate.sh" .github/workflows/release-please.yml` returns nothing.
   In the `release-please` job, add a checkout of `main` and the `Hold the release until its note exists` step (id `gate`) before the release-please-action step. Remove the `Checkout the tagged commit` step. Run the mirror step only when `steps.gate.outputs.mirror == 'true'`, and drop its own `exit 1` when the note is missing. Keep the project's other jobs and steps as they are.
   Done when: `rg "release-note-gate.sh" .github/workflows/release-please.yml` matches, the gate step comes before `googleapis/release-please-action`, and the mirror step reads `steps.gate.outputs.mirror`.

3. **CI test** — signal: `rg "release-note-gate.test.sh" .github/workflows/ci.yml` returns nothing.
   Add the `Test the release note gate` step to the lint job, or to whichever job the project runs on every pull request.
   Done when: `rg "release-note-gate.test.sh" .github/workflows/ci.yml` matches.

4. **Release docs** — signal: `rg "is held" apps/documentation/src/content/docs/references/1_release_and_versionning.mdx` returns nothing.
   In the "Changelog and release notes" section of the release reference page, and of its French copy if the project keeps it, say that a project that wants this guard sets `REQUIRE_RELEASE_NOTE` to `true`, and how a held release is published. Update the `REQUIRE_RELEASE_NOTE` line of `scripts/github-repo-settings.md` if the project keeps that file.
   Done when: `rg "is held" apps/documentation/src/content/docs` matches each page the project keeps, and `rg "Release Please" scripts/github-repo-settings.md` matches if that file exists.

5. **Release skill** — signal: `rg "is held" .claude/skills/project-release/SKILL.md` returns nothing.
   Add the "held" paragraph to the "After the human merges" section of the `project-release` skill, in `.claude` and `.cursor` if both exist.
   Done when: `rg "is held"` matches in every copy of the skill.

## Out of Scope

- Setting `REQUIRE_RELEASE_NOTE`. A project that wants the guard runs `gh variable set REQUIRE_RELEASE_NOTE --body true`; only a human decides it.
- The `Release note` check in `release-note.yml`. It stays as it is.
- Release Please settings, branch protection and required checks.

## Reference Paths

- `.github/scripts/release-note-gate.sh` — **copy**
- `.github/scripts/release-note-gate.test.sh` — **copy**
- `.github/workflows/release-please.yml` — **adapt**
- `.github/workflows/ci.yml` — **adapt**
- `apps/documentation/src/content/docs/references/1_release_and_versionning.mdx` — **adapt**
- `apps/documentation/src/content/docs/fr/references/1_release_and_versionning.mdx` — **adapt**
- `.claude/skills/project-release/SKILL.md` — **adapt**
- `.cursor/skills/project-release/SKILL.md` — **adapt**
- `scripts/github-repo-settings.md` — **adapt**

## Validation

- `bash .github/scripts/release-note-gate.test.sh` passes.
- `pnpm fmt:check` passes.
- The `Release Please` workflow file still parses, and its gate step comes before `googleapis/release-please-action`.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/release-note-holds-the-tag --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
