---
id: v1.0.0/migrate-mikro-orm-v7
domain: api
classification: migration
---

# Migrate MikroORM V7 Baseline

## Goal

The API project uses the MikroORM v7 baseline: v7 packages, `defineConfig` + `ReflectMetadataProvider` wiring, and the v7-compatible test database helper.

## Why

MikroORM v7 moved decorator metadata into `@mikro-orm/decorators` (`ReflectMetadataProvider` now comes from `@mikro-orm/decorators/legacy`) and changed the configuration entry points. Projects on older MikroORM versions fail typecheck or entity discovery when adopting other v1.0.0 API changes.

## Applies When

- The project has a NestJS API app based on the boilerplate.
- `apps/api/package.json` declares `@mikro-orm/*` packages below v7.
- The project wants to track the boilerplate `api` domain.

## Do Not Apply When

- The project has no API app or does not use MikroORM.
- The project intentionally pinned an older MikroORM version — record as skipped with that reason.
- Closing a gap would require regenerating existing migration history (stop and ask a human).

## Observable Gaps

Work through each gap independently; skip any that is already closed.

1. **Package versions** — signal: `@mikro-orm/core` below v7 in `apps/api/package.json`.
   Align every `@mikro-orm/*` version with the staged reference `apps/api/package.json`, including the `@mikro-orm/decorators` package that is new in v7. Touch no other dependency.
   Done when: install succeeds and `pnpm --filter=api typecheck` reports no `@mikro-orm` import errors.

2. **Config wiring** — signal: the MikroORM config does not use `defineConfig` from `@mikro-orm/postgresql`, or imports `ReflectMetadataProvider` from anywhere other than `@mikro-orm/decorators/legacy`.
   Compare with the staged reference `apps/api/src/modules/db/db.config.ts` and adapt imports and options. Keep the project's own connection settings, naming strategy, and extensions.
   Done when: the API boots and entity discovery finds the project's entities.

3. **Test database helper** — signal: `apps/api/src/test/helpers/test-db.helper.ts` (or the project's equivalent) fails typecheck after gap 1, or predates the v7 pattern.
   Align only the ORM setup with the staged reference helper. Keep project-specific fixtures, seeds, and container tooling.
   Done when: API database tests pass, or are reported unavailable.

## Out of Scope

- The project's entities, repositories, custom types, and business queries — never rewritten.
- Existing migration files and migration history — never regenerated.
- Seed data and fixtures.

## Reference Paths

- `apps/api/package.json`
- `apps/api/src/modules/db/`
- `apps/api/src/test/helpers/test-db.helper.ts`

## Validation

- `pnpm --filter=api typecheck` passes.
- API database tests pass if available; report a missing test script as unavailable, not as passing.
- Existing migrations are untouched (no changes under the migrations directory).

## Record Result

Run `pnpm boilerplate upgrade record --id v1.0.0/migrate-mikro-orm-v7 --applied` after validation passes, or record it as skipped with a reason.
