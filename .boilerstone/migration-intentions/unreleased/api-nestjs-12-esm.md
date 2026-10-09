---
id: unreleased/api-nestjs-12-esm
domain: api
classification: breaking-manual
---

# Run the API on NestJS 12 as ESM, built with Vite

## Goal

The API runs on stable NestJS 12.1 as an ES module, validates and documents routes with Nest's built-in Standard Schema support instead of `@lonestone/nzoth`, builds, runs in dev and tests through one Vite + SWC config, and applies production migrations with `node dist/migrate.js`.

## Why

NestJS 12 packages are ESM-only, so the API package becomes `"type": "module"`. Nest 12 also ships Standard Schema support: a validation pipe, a serializer interceptor, a `schema` option on `@Body` / `@Param` / `@Query`, and `standardSchema` on Swagger response decorators. That covers what `@lonestone/nzoth` provided, so the API drops it.

Build, dev and tests share one Vite + SWC config. SWC keeps decorator metadata, Vite bundles `main.js` and `migrate.js`, and Vitest already depended on Vite. A Nest CLI Rspack build was tried first and dropped: it needed custom externals for the hoisted pnpm layout and a hand-built migrations list.

The image ships no `src/`, so the MikroORM CLI cannot run there. `dist/migrate.js` calls the migrator directly, which makes the `MIKRO_ORM_CLI_*` variables from `v1.2.0/api-image-mikro-orm-prefer-ts` unnecessary.

## Applies When

- The project has `apps/api` and `@nestjs/core` is 11.x in `apps/api/package.json`. Being on Nest 11 is the starting state, not a skip reason.
- `apps/api/package.json` has no `"type": "module"`, or still depends on `@lonestone/nzoth`, or its `build` script is `nest build`.

## Do Not Apply When

- The project has no API app.
- The API depends on a Nest package with no Nest 12 release and no peer range that accepts 12 (check `npm view <pkg> peerDependencies`). Stop and list the blockers.
- The API relies on CommonJS-only runtime behavior (`require()` of local files, `__dirname` without `import.meta.dirname`, CJS-only plugins). Stop and ask.
- A human reviewed this intention and decided to stay on Nest 11. Record as skipped with that reason.

## Observable Gaps

Work gap by gap. Skip example modules the project removed. Keep business logic as is: only decorators, imports and config move.

1. **Dependencies and ESM** — signal: `apps/api/package.json` has `@nestjs/core` 11.x, no `"type": "module"`, or lists `@lonestone/nzoth`.
   Align the Nest pins (`@nestjs/*` 12.1.x, `@nestjs/config` / `swagger` / `cli` / `schematics` 12.0.x), `@amplication/opentelemetry-nestjs` 7, `@mikro-orm/nestjs` 7.1, `express` 5 and `nestjs-pino` 5 with the staged reference. Add `"type": "module"`. Remove `@lonestone/nzoth` from every app. In `pnpm-workspace.yaml`, remove any `allowAny` on `@nestjs/*` and add only the scoped `@sentry/nestjs>@nestjs/*` exception.
   Done when: `pnpm install` passes with `strictPeerDependencies: true` and `rg @lonestone/nzoth apps/*/package.json` returns nothing.

2. **TypeScript module settings** — signal: `apps/api/tsconfig.json` uses `"module": "nodenext"` or lacks `verbatimModuleSyntax`.
   Use `module: ESNext`, `moduleResolution: bundler`, `isolatedModules` and `verbatimModuleSyntax` like the staged reference. Convert type-only imports to `import type`.
   Done when: `pnpm --filter=api typecheck` passes.

3. **Validation, serialization and OpenAPI** — signal: `rg "@lonestone/nzoth" apps/api/src` returns matches (`TypedRoute`, `TypedBody`, `TypedParam`, `TypedQuery`, `registerSchema`).
   Register `StandardSchemaValidationPipe` and `StandardSchemaSerializerInterceptor` globally in `main.ts`. Replace each typed decorator with the Nest decorator plus `{ schema }`, `@SerializeOptions({ schema })` and `@ApiOkResponse({ standardSchema })`, following the staged posts and comments controllers. Copy `apps/api/src/common/http/`: its OpenAPI converter turns each `.meta({ title })` into a named component, as nzoth did, so the generated client keeps type names such as `CommentSchema`; its `sort` / `filter` helpers keep the `format` the OpenAPI generator turns into typed arrays. Swagger marks every named `@Query` as required, so add `@ApiQuery({ name, required: false })` for optional ones such as `sort` and `filter`. Declare path parameters the method does not read with `@ApiParam`. Replace each nzoth `registerSchema()` with the one from `common/http/openapi.ts`, and call `addRegisteredSchemas(document)` after `SwaggerModule.createDocument`. Set `app.set('query parser', 'extended')`, because Express 5 no longer expands nested query keys.
   Done when: `rg @lonestone/nzoth apps/api/src` returns nothing, and after `pnpm generate` against the dev server the frontend apps typecheck with no change to their imports.

4. **Static entity list** — signal: `apps/api/src/modules/db/db.config.ts` discovers entities through a glob.
   Run `pnpm --filter=api db:entities` (script from the staged reference) and point `entities` / `entitiesTs` to `entities.generated.ts`. Bundled ESM code has no entity files left to scan.
   Done when: `db.config.ts` imports `./entities.generated` and the API boots against an empty database.

5. **Build, dev and tests on Vite** — signal: `apps/api/package.json` runs `nest build` / `nest start`, or `apps/api/vitest.config.ts` exists.
   Replace it with the staged `apps/api/vite.config.ts`. Adopt the `build`, `dev` and `test` scripts. Remove the Nest CLI builder options from `nest-cli.json`, but keep the CLI for schematics. Set `module.type: es6` in `.swcrc`.
   Done when: `pnpm --filter=api build` emits `dist/main.js`, `dist/migrate.js` and `dist/modules/db/migrations/*.js`, and `pnpm --filter=api test` passes.

6. **Production migrations** — signal: `apps/api/Dockerfile` runs `db:migrate:up`, or sets `MIKRO_ORM_CLI_PREFER_TS` / `MIKRO_ORM_CLI_CONFIG`.
   Copy `apps/api/src/migrate.ts`, add the `db:migrate:prod` script, change the image `CMD` to `pnpm db:migrate:prod && pnpm run start`, and remove both `MIKRO_ORM_CLI_*` lines.
   Done when: the built image, started against an empty Postgres, applies every migration before the API answers on `/api/`.

## Out of Scope

- Upgrading `@sentry/nestjs` to 11. It keeps a scoped peer exception for now.
- The schema-drift check in `src/test/setup/test.global-setup.ts`. Adopt it separately if wanted.
- The Better Auth integration and its `/auth/*` route wildcard.
- Entities, services, business queries and migration files themselves.
- Frontend apps beyond removing the unused `@lonestone/nzoth` dependency.

## Reference Paths

- `apps/api/package.json` — **adapt**
- `pnpm-workspace.yaml` — **adapt**
- `apps/api/tsconfig.json` — **adapt**
- `apps/api/vite.config.ts` — **adapt**
- `apps/api/.swcrc` — **copy**
- `apps/api/nest-cli.json` — **copy**
- `apps/api/src/main.ts` — **adapt**
- `apps/api/src/migrate.ts` — **copy**
- `apps/api/src/common/http/` — **copy**
- `apps/api/src/modules/db/db.config.ts` — **adapt**
- `apps/api/src/modules/example/posts/posts.controller.ts` — **adapt**
- `apps/api/src/modules/example/comments/comments.controller.ts` — **adapt**
- `apps/api/Dockerfile` — **adapt**

## Validation

- `pnpm install` passes with strict peer dependencies.
- `pnpm typecheck` and `pnpm lint` pass.
- `pnpm --filter=api test` passes.
- `pnpm --filter=api build` emits `dist/main.js`, `dist/migrate.js` and the compiled migrations.
- `docker build -f apps/api/Dockerfile .` succeeds, and the image applies all migrations on an empty Postgres, then `/api/` returns 200.
- `pnpm generate` still produces the frontend clients without type errors.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/api-nestjs-12-esm --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
