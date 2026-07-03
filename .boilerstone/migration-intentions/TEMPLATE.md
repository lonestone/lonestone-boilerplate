---
id: vX.Y.Z/slug
domain: tooling
classification: migration
---

# Migration Intention Template

> The frontmatter block above must stay on the very first line of the file — the parser only reads it there.

## Metadata

- `id`: stable identifier recorded in `.boilerstone/boilerplate.json`
- `domain`: one of the consumer project's tracked domains (`tooling`, `api`, `frontend`, `ci`, `docker-env`, `monitoring`, `email`, `auth`, `storage`)
- `classification`: `migration` or `breaking-manual` for actionable intentions

## Goal

<!-- Describe the expected end state in one sentence -->

## Why

<!-- Explain the reason behind this boilerplate change -->

## Applies When

<!-- Explicit checks that indicate this migration applies to the consumer project -->
<!-- Example: "- Project uses NestJS S3 module" -->
<!-- Example: "- File `apps/api/src/modules/storage/s3.service.ts` exists" -->

## Do Not Apply When

<!-- Explicit stop conditions -->
<!-- Example: "- Project uses a custom storage solution" -->
<!-- Example: "- Project does not have the `api` app" -->

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
<!-- `upgrade prepare` stages these from the target tag into reference/target/, -->
<!-- so keep them small and specific — no lockfiles or generated artifacts. -->
<!-- Example: "- `apps/api/src/modules/storage/`" -->

## Validation

<!-- Required checks after applying the migration -->
<!-- Example: "- `pnpm lint` passes" -->
<!-- Example: "- `pnpm typecheck` passes" -->
<!-- Example: "- API starts without errors" -->

## Record Result

<!-- How to record after validation -->
<!-- Example: "Run `pnpm boilerplate upgrade record --id vX.Y.Z/slug --applied`" -->
