---
id: unreleased/api-image-mikro-orm-prefer-ts
domain: docker-env
classification: migration
---

# Let the API image find its entities when running migrations

## Goal

The API Docker image sets `MIKRO_ORM_CLI_PREFER_TS=false`, so `pnpm db:migrate:up` discovers the compiled entities in `dist/` and the container can start.

## Why

MikroORM v7 no longer reads `MIKRO_ORM_CLI_USE_TS_NODE`: the CLI reads `MIKRO_ORM_CLI_PREFER_TS`. When it is not set, the CLI prefers TypeScript and discovery uses `entitiesTs` (`./src/**/*.entity.ts`). The image only ships `dist/`, so the container command fails with `MetadataError: No entities were discovered` before the API starts.

## Applies When

- The project has `apps/api/Dockerfile`.
- The project is on MikroORM v7 (`@mikro-orm/core` 7.x in `apps/api/package.json`).
- The Dockerfile still sets `ENV MIKRO_ORM_CLI_USE_TS_NODE=false`, or sets neither variable. That is the starting state this intention migrates away from, not a skip reason.

## Do Not Apply When

- The project has no API app, or does not build an API Docker image.
- The project is still on MikroORM v6 or earlier, where `MIKRO_ORM_CLI_USE_TS_NODE` is the variable the CLI reads. Stop and ask.
- The image ships the TypeScript sources and runs the CLI through a TS loader on purpose. Stop and ask rather than forcing JS discovery.

## Observable Gaps

1. **CLI env var** — signal: `apps/api/Dockerfile` contains `MIKRO_ORM_CLI_USE_TS_NODE` or has no `MIKRO_ORM_CLI_PREFER_TS`.
   Replace the line with `ENV MIKRO_ORM_CLI_PREFER_TS=false` and keep the comment from the staged reference. Leave `MIKRO_ORM_CLI_CONFIG` unchanged.
   Done when: grepping the Dockerfile shows `MIKRO_ORM_CLI_PREFER_TS=false` and no `MIKRO_ORM_CLI_USE_TS_NODE`.

2. **Other runtime env** — signal: a Dokploy, compose or CI definition sets `MIKRO_ORM_CLI_USE_TS_NODE` for the API container.
   Rename it to `MIKRO_ORM_CLI_PREFER_TS` with the same value.
   Done when: no deployment definition in the repository sets `MIKRO_ORM_CLI_USE_TS_NODE`.

## Out of Scope

- `apps/api/src/modules/db/db.config.ts` and the `entities` / `entitiesTs` globs.
- Test helpers that set `preferTs: true` on purpose.
- The container `CMD` and the migration files themselves.

## Reference Paths

- `apps/api/Dockerfile` — **adapt**

## Validation

- `docker build -f apps/api/Dockerfile .` succeeds.
- Running the image against an empty Postgres with `pnpm db:migrate:up` prints `Successfully migrated up to the latest version` instead of `No entities were discovered`.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/api-image-mikro-orm-prefer-ts --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
