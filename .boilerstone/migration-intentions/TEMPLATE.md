---
id: unreleased/slug
domain: tooling
classification: migration
requires:
  - unreleased/other-slug
---

# Migration Intention Template

> The frontmatter block above must stay on the very first line of the file — the parser only reads it there.

## Filename

**During a pull request**, write the file as `.boilerstone/migration-intentions/unreleased/slug.md`. No `NN-` prefix. The frontmatter `id:` is `unreleased/slug`. Optional `pr:` records the pull request number.

**At release time** the maintainer promotes the file into `vX.Y.Z/NN-slug.md`. `NN` is a zero-padded execution-order prefix (`00`, `01`, `02`, ...). Filename sort order within a release directory IS the execution order — it drives both intention staging and the generated session checklist. The frontmatter `id:` is rewritten to `vX.Y.Z/slug` and never carries the `NN-` prefix. `pnpm boilerplate intentions lint` validates every `requires:` entry against this order.

## Metadata

- `id`: stable identifier recorded in `.boilerstone/boilerplate.json` (`unreleased/slug` until promote, then `vX.Y.Z/slug`)
- `domain`: a tracked domain / commit scope. Valid values live in `commitlint.config.ts` — do not copy the list here
- `classification`: `migration` or `breaking-manual` for actionable intentions
- `requires`: ids of intentions that must be applied or staged first (optional)
- `pr`: pull request number (optional, useful on unreleased files)

## Goal

<!-- Describe the expected end state in one sentence -->

## Why

<!-- Explain the reason behind this boilerplate change -->

## Applies When

<!-- Explicit checks that indicate this migration applies to the consumer project -->
<!-- Example: "- Project uses NestJS S3 module" -->
<!-- Example: "- File `apps/api/src/modules/storage/s3.service.ts` exists" -->

## Do Not Apply When

<!-- Hard stop conditions only — not the starting stack this intention migrates away from. -->
<!-- Skip for "still on the old tool" is an anti-pattern; agents must propose apply/skip to a human. -->
<!-- Example: "- Project uses a custom storage solution" -->
<!-- Example: "- Project does not have the `api` app" -->
<!-- Example: "- A human explicitly decided to keep the prior stack after review" -->

## Observable Gaps

<!-- 3-6 independent, detectable deltas. Each gap needs: a greppable signal, -->
<!-- the reference file to compare against, and a binary "Done when". -->
<!-- Example: -->
<!-- 1. **Package versions** — signal: `@some/pkg` < 2 in `apps/api/package.json`. -->
<!--    Align with the staged reference `apps/api/package.json`; touch no other dependency. -->
<!--    Done when: `pnpm --filter=api typecheck` passes. -->

## Out of Scope

<!-- What this intention must NOT touch, even if it looks related. -->
<!-- This is what keeps an executor from boiling the ocean. -->
<!-- Example: "- The project's entities and business queries — never rewritten." -->

## Reference Paths

<!-- Files or directories from the boilerplate to compare. -->
<!-- Every path must declare its policy: -->
<!-- - copy: the target ref is the source of truth; copy it verbatim. -->
<!-- - adapt: compare project, source and target; preserve project-specific deltas. -->
<!-- `upgrade prepare` stages available paths from both refs, so keep them small -->
<!-- and specific — no lockfiles or generated artifacts. -->
<!-- Example: "- `apps/api/src/modules/storage/` — **adapt**" -->

## Validation

<!-- Required checks after applying the migration -->
<!-- Example: "- `pnpm lint` passes" -->
<!-- Example: "- `pnpm typecheck` passes" -->
<!-- Example: "- API starts without errors" -->

## Record Result

<!-- How to record after validation -->
<!-- Example: "Run `pnpm boilerplate upgrade record --id vX.Y.Z/slug --applied`" -->
