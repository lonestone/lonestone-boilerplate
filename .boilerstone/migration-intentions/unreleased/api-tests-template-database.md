---
id: unreleased/api-tests-template-database
domain: api
classification: migration
---

# Speed up the API e2e tests with a fast test Postgres and a template database

## Goal

The API test run uses a test Postgres without durability, builds the schema once in a template database, and gives each e2e test a copy of that template that it drops when it ends.

## Why

Most of the e2e test time went into the database, not into the code under test:

- The test Postgres wrote every commit to disk safely. Test data only lives as long as the run, so that safety buys nothing. Turning it off and keeping the data in memory cut the longest e2e file from about 85 s to about 10 s on a busy server.
- Each e2e test rebuilt the whole schema with `orm.schema.refresh()`. Copying a template database built once per run (`CREATE DATABASE … TEMPLATE`) is faster, and the cost no longer grows with the number of entities.
- Test databases were never dropped. They piled up in the container until the run ended.

What a test sees does not change: each test still gets its own empty database with the full schema.

## Applies When

- `apps/api/src/test/setup/test.global-setup.ts` starts a `PostgreSqlContainer`.
- `createTestOrm` in `apps/api/src/test/helpers/test-db.helper.ts` creates one database per test.

## Do Not Apply When

- `.boilerstone/migration-intentions/` exists. This is the boilerplate repository, or a fork that publishes its own intentions. Record as skipped.
- The project's API tests do not run against PostgreSQL.

## Observable Gaps

1. **Test Postgres without durability** — signal: `rg "fsync=off" apps/api/src/test/setup/test.global-setup.ts` finds nothing.
   Add the `.withTmpFs(...)` and `.withCommand([...])` calls from the staged `test.global-setup.ts` to the container. Keep the project's image tag and its other container options.
   Done when: `rg "fsync=off" apps/api/src/test/setup/test.global-setup.ts` matches and the e2e tests pass.
2. **Template database** — signal: `rg "createTemplateDatabase" apps/api/src/test` finds nothing.
   Copy `TEMPLATE_DB_NAME`, `createTemplateDatabase` and the new `createTestOrm` from the staged `test-db.helper.ts`. In the global setup, call `createTemplateDatabase` after the environment variables are set, through a dynamic `import()`, as the staged file does. If the project's `createTestOrm` runs migrations instead of `schema.refresh()`, build the template the same way the project built each test database.
   Done when: `rg "TEMPLATE" apps/api/src/test/helpers/test-db.helper.ts` matches and the e2e tests pass.
3. **Test databases dropped** — signal: `rg "DROP DATABASE" apps/api/src/test/helpers/test-db.helper.ts` finds nothing.
   Copy `cleanupTestOrm`, `runOnServer` and the `testDatabases` map from the staged `test-db.helper.ts`. Check that the project's e2e `afterEach` calls `cleanupTestOrm`.
   Done when: `rg "DROP DATABASE" apps/api/src/test/helpers/test-db.helper.ts` matches and the e2e tests pass.
4. **Test docs** — signal: `rg "test_template" apps/api/src/test/README.md` finds nothing.
   Bring the README and the helper comments in line with the staged files. Keep the project's own sections.
   Done when: `rg "test_template" apps/api/src/test/README.md` matches and `rg -i "per test|test container" apps/api/src/test/helpers` finds no comment that still describes a container or a schema built for each test.

## Out of Scope

- The test files themselves (`*.e2e-spec.ts`, `*.spec.ts`).
- `initializeTestApp`: it still opens its own ORM for the Nest app. That costs about 18 ms per test, and sharing the test's ORM would let the Nest app close it.
- The Vitest config and its worker count. The boilerplate has two e2e files, so the longest one sets the time whatever the worker count.

## Reference Paths

- `apps/api/src/test/setup/test.global-setup.ts` — **adapt**
- `apps/api/src/test/helpers/test-db.helper.ts` — **adapt**
- `apps/api/src/test/README.md` — **adapt**

## Validation

- `pnpm --filter=api typecheck` passes.
- `pnpm --filter=api test` passes, with every e2e test green.
- The e2e test time drops compared with before the change.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/api-tests-template-database --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
