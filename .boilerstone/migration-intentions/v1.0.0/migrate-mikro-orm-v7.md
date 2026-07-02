---
id: v1.0.0/migrate-mikro-orm-v7
domain: api
classification: migration
---

# Migrate MikroORM V7 Baseline

## Goal

Align an older API project with the v1.0.0 MikroORM v7 baseline.

## Why

The v1.0.0 boilerplate uses MikroORM v7 patterns in the API configuration, test helpers, and entity setup. Older projects may need targeted changes to keep database configuration, metadata providers, and tests compatible.

## Applies When

- The project has a NestJS API app based on the boilerplate.
- The project uses MikroORM and wants to track the boilerplate API domain.
- The installed MikroORM packages or configuration differ from the v1.0.0 reference.

## Do Not Apply When

- The project does not have an API app.
- The project does not use MikroORM.
- The project intentionally pinned an older MikroORM version for application-specific reasons.
- The migration requires a schema/data decision that is not covered by the boilerplate reference.

## Reference Paths

- `apps/api/package.json`
- `apps/api/src/modules/db/`
- `apps/api/src/test/`
- `apps/api/mikro-orm.config.ts` or the project's equivalent MikroORM config

## Suggested Agent Workflow

1. Inspect the project's MikroORM package versions and API database configuration.
2. Compare metadata provider, entity discovery, migrations, and test database helpers with the v1.0.0 reference.
3. Apply only compatibility changes required by the project; do not rewrite entities wholesale.
4. Preserve project-specific entities, migrations, seed data, and database naming.
5. Stop and ask a human before changing production migration history.

## Validation

- `pnpm --filter=api typecheck` passes.
- API database tests pass if available.
- Existing migrations are not rewritten.

## Record Result

Run `pnpm boilerplate upgrade record --id v1.0.0/migrate-mikro-orm-v7 --applied` after validation passes, or record it as skipped with a reason.
