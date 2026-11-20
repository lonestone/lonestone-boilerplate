---
id: unreleased/release-in-batches
domain: tooling
classification: migration
---

# Tell agents to ship in batches and write the release note last

## Goal

The project's release page and its `project-release` skill say that releases ship in batches (several pull requests, then one release), give the order to follow, and warn that the release note is written or renamed last.

## Why

Release Please changes the version of its Release PR every time another pull request lands on `main`. A project with three or four agents working in parallel went through three rounds for each release: the pull request, then the release note named after the version, then the Release PR, which had already changed version and started the CI again. The note had to be renamed each time. The right habit is to merge the pull requests of the batch first, then write the note on the Release PR, then merge it.

## Applies When

- The project tracks the `tooling` domain.
- The project versions with release-please.
- `.claude/skills/project-release/SKILL.md` or `apps/documentation/src/content/docs/references/1_release_and_versionning.mdx` exists and does not contain "Ship in batches".

## Do Not Apply When

- `.boilerstone/migration-intentions/` exists. This is the boilerplate repository, or a fork that publishes its own intentions. Record as skipped.
- The project has no versions (no Release PR). Record as skipped.
- A human has decided that the project releases after every merge. Record as skipped with that reason.

## Observable Gaps

1. **Release reference page** — signal: `rg "Ship in batches" apps/documentation/src/content/docs/references/1_release_and_versionning.mdx` returns nothing.
   Add the "Ship in batches" section of the reference page, before "What the pipeline produces". Keep the project's own wording where it differs. In the "Changelog and release notes" section, replace the advice to write the note before the Release PR exists with the advice to check the version and rename the note just before merging.
   Done when: `rg "Ship in batches"` matches in the page, and the order (merge pull requests, update the note, merge the Release PR) and the version warning are both there.

2. **French page** — signal: the project keeps `fr/references/1_release_and_versionning.mdx` and it has no "Livrer par paquets".
   Add the same section in French.
   Done when: `rg "Livrer par paquets"` matches.

3. **Skill** — signal: `rg "Ship in batches" .claude/skills/project-release/SKILL.md` returns nothing.
   Add the "Ship in batches" step to the Job list, and drop the sentence that says to write the note before the Release PR exists. Do the same in `.cursor/skills/project-release/SKILL.md` if the project has that copy.
   Done when: `rg "Ship in batches" .claude/skills/project-release/SKILL.md` matches.

## Out of Scope

- Changing the `Release note` check or the `REQUIRE_RELEASE_NOTE` variable.
- Release Please settings, branch protection and required checks. Only a human changes them.

## Reference Paths

- `apps/documentation/src/content/docs/references/1_release_and_versionning.mdx` — **adapt**
- `apps/documentation/src/content/docs/fr/references/1_release_and_versionning.mdx` — **adapt**
- `.claude/skills/project-release/SKILL.md` — **adapt**
- `.cursor/skills/project-release/SKILL.md` — **adapt**

## Validation

- `rg "Ship in batches" apps/documentation/src/content/docs/references .claude/skills/project-release` matches.
- `pnpm fmt:check` passes.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/release-in-batches --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
