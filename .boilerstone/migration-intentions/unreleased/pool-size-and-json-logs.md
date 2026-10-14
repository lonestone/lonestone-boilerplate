---
id: unreleased/pool-size-and-json-logs
domain: api
classification: migration
---

# Configure the database pool size and log JSON outside development

## Goal

Each API instance opens at most `DATABASE_POOL_MAX` database connections, and the API writes one JSON object per log line outside development, including its startup logs.

## Why

Both settings matter once a project runs more than one API instance.

The pool size could not be changed. MikroORM kept the `pg` default of 10 connections per instance, and PostgreSQL accepts 100 by default. Around eight instances, plus migrations and admin tools, the database refuses new connections. `DATABASE_POOL_MAX` keeps 10 as the default, so nothing changes until a project sets it.

The API used `pino-pretty` in every environment, with `pid` and `hostname` removed. In production that gave colored text that a log platform cannot parse, and no way to tell which instance wrote a line. `pino-pretty` now runs only in `development`. Elsewhere, pino writes JSON with `pid` and `hostname`. `bufferLogs: true` holds Nest's startup logs until pino is in place, so they come out as JSON too instead of Nest's colored console format.

Request logs skip `/api/health`. A load balancer polls it every few seconds, and those lines would bury real traffic. The rule is harmless when the route does not exist.

## Applies When

- The project has the `api` app with `nestjs-pino`.
- `apps/api/src/app.module.ts` sets the `pino-pretty` transport without checking the environment.
- `apps/api/src/config/env.config.ts` has no `DATABASE_POOL_MAX`.

## Do Not Apply When

- The project has no `api` app.
- The project already ships logs through its own logger or transport. Apply only the pool size.

## Observable Gaps

1. **Pool size setting** — signal: `rg "DATABASE_POOL_MAX" apps/api/src` finds nothing.
   Align `env.config.ts` (optional variable, default 10, exposed as `config.database.poolMax`) and `db.config.ts` (`pool: { max: config.database.poolMax }`) with the staged references. Add the commented line to `apps/api/.env.example`.
   Done when: with `DATABASE_POOL_MAX=3` and concurrent requests, `pg_stat_activity` shows at most 3 connections from the API.

2. **Log format** — signal: `apps/api/src/app.module.ts` sets `target: 'pino-pretty'` without a `config.env === 'development'` check.
   Align with the staged `app.module.ts`. Keep the project's own `pinoHttp` options.
   Done when: with `NODE_ENV=production`, every request log line starts with `{` and contains `pid` and `hostname`.

3. **Startup logs** — signal: `apps/api/src/main.ts` calls `NestFactory.create` without `bufferLogs: true`.
   Add it next to the existing options.
   Done when: with `NODE_ENV=production`, the `Mapped` and `Nest application successfully started` lines are JSON.

4. **Health check noise** — signal: `autoLogging` is `true` in `app.module.ts`.
   Align with the staged `autoLogging.ignore` rule for `/api/health`.
   Done when: calls to `/api/health` add no request log line.

## Out of Scope

- Log shipping, log retention, and Sentry configuration.
- PgBouncer or any other connection pooler.
- The `dotenvx` banner printed before the logger starts.

## Reference Paths

- `apps/api/src/config/env.config.ts` — **adapt**
- `apps/api/src/modules/db/db.config.ts` — **adapt**
- `apps/api/src/app.module.ts` — **adapt**
- `apps/api/src/main.ts` — **adapt**
- `apps/api/.env.example` — **adapt**
- `apps/api/README.md` — **adapt**

## Validation

- `pnpm --filter=api typecheck` passes.
- `pnpm --filter=api test` passes.
- `pnpm lint` passes.
- `pnpm --filter=api dev` still prints readable, colored logs.

## Record Result

Run `pnpm boilerplate upgrade record --id <release>/pool-size-and-json-logs --applied` after validation passes, or record it as skipped with a reason.
