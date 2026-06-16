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

## Reference Paths

<!-- Files or directories from the boilerplate to compare -->
<!-- Example: "- `apps/api/src/modules/storage/`" -->
<!-- Example: "- `packages/ui/src/components/`" -->

## Suggested Agent Workflow

<!-- Ordered steps for the AI agent to follow -->
<!-- Example: -->
<!-- 1. Read reference files in `apps/api/src/modules/storage/` -->
<!-- 2. Compare with project's existing storage module -->
<!-- 3. Add missing exports and types -->
<!-- 4. Update imports in affected files -->

## Validation

<!-- Required checks after applying the migration -->
<!-- Example: "- `pnpm lint` passes" -->
<!-- Example: "- `pnpm typecheck` passes" -->
<!-- Example: "- API starts without errors" -->

## Record Result

<!-- How to update boilerplate.json after validation -->
<!-- Example: "Add intention ID `vX.Y.Z/slug` to `intentions.applied`" -->
