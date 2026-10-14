---
id: unreleased/locked-migrations-and-health-check
domain: docker-env
classification: migration
---

# Run startup migrations under a lock and expose a health check

## Goal

API containers that start together apply pending migrations once, and `GET /api/health` tells a load balancer whether an instance can reach its database.

## Why

The API image ran `pnpm db:migrate:up` before starting. MikroORM takes no lock while it migrates. When two instances start at the same time, which happens with several replicas or a deploy that starts the new container before stopping the old one, both run the same migrations. Reproduced on a fresh database: the second container exited with `duplicate key value violates unique constraint` while both created the migrations table. A schema migration fails in the same way and the container restarts. A data migration (an `UPDATE`) can be applied twice.

`src/migrate.ts` now takes a PostgreSQL advisory lock on a dedicated connection, applies pending migrations, then releases the lock. The other instances wait, then find nothing left to apply. A lock inside the container was preferred over a pre-deploy step because it works the same on Dokploy, Render and Docker Compose.

The start command now ends with `exec node dist/main.js` instead of `pnpm run start`. Node becomes the container's main process and exits with code 0 on `docker stop`. Through pnpm, the signal also reached Node, but pnpm reported `ELIFECYCLE` and exited with code 1, which deploy tools read as a crash.

The API had no real health check: `GET /api` answers "Hello World" without touching the database. `GET /api/health` runs `select 1` and answers 503 when it fails. It does not use `orm.checkConnection()`: MikroORM 7 opens its connection on the first query, so that method reports a failure until a query has run.

## Applies When

- The project has the `api` app and deploys it with `apps/api/Dockerfile`.
- The Dockerfile `CMD` runs `db:migrate:up` (or the MikroORM CLI) before starting the API.
- `apps/api/src/app.controller.ts` has no `health` route.

## Do Not Apply When

- The project has no `api` app.
- Migrations already run in a separate deploy step, outside the API container, with a single runner. Apply only the health check.
- The project already exposes its own health route that checks the database. Skip the health part and record why.

## Observable Gaps

1. **Migration script** — signal: `apps/api/src/migrate.ts` does not exist.
   Copy the staged reference. Keep the lock key constant once deployed.
   Done when: `pnpm --filter=api build` emits `dist/migrate.js`.

2. **Container start command** — signal: `apps/api/Dockerfile` `CMD` contains `db:migrate:up` or `pnpm run start`.
   Align with the staged reference: `node dist/migrate.js && exec node dist/main.js`. Keep any project-specific step that runs before the API starts.
   Done when: two containers started at the same time on a database with pending migrations both reach "Nest application successfully started", and `mikro_orm_migrations` has no duplicate name.

3. **Health route** — signal: `rg "'health'" apps/api/src/app.controller.ts` finds nothing.
   Align with the staged `app.controller.ts` and its e2e test. The route must stay `@AllowAnonymous()`.
   Done when: `GET /api/health` returns 200 with the database up and 503 without it.

4. **Knip entry** — signal: `knip.json` does not list `src/migrate.ts!` for `apps/api`.
   Add it next to `src/main.ts!`.
   Done when: `pnpm knip` reports no unused file for `apps/api`.

5. **Documentation** — signal: `apps/api/README.md` still tells to uncomment a Dockerfile line to run migrations.
   Align with the staged README section "Migrations and health check" and the database management guide.
   Done when: both describe `node dist/migrate.js` and the health route.

## Out of Scope

- The project's migrations and entities.
- The web apps' Dockerfiles.
- Deployment platform settings. Pointing the platform's health check at `/api/health` is a follow-up the project owner decides.

## Reference Paths

- `apps/api/src/migrate.ts` — **copy**
- `apps/api/Dockerfile` — **adapt**
- `apps/api/src/app.controller.ts` — **adapt**
- `apps/api/src/app.controller.e2e-spec.ts` — **copy**
- `knip.json` — **adapt**
- `apps/api/README.md` — **adapt**
- `apps/documentation/src/content/docs/guides/database-management.mdx` — **adapt**

## Validation

- `pnpm --filter=api typecheck` passes.
- `pnpm --filter=api test` passes.
- `pnpm lint` passes.
- The API image builds. Two containers started together on a fresh database both start, one log says `Applied migrations`, the other `No pending migrations`.
- `docker stop` on an API container exits with code 0.

## Record Result

Run `pnpm boilerplate upgrade record --id <release>/locked-migrations-and-health-check --applied` after validation passes, or record it as skipped with a reason.
