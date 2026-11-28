---
id: unreleased/api-tests-changed-and-worker-database
domain: api
classification: migration
requires:
  - unreleased/api-tests-template-database
---

# Run only the affected tests while working, and reuse one test database per worker

## Goal

`pnpm test:changed` runs only the tests a branch can affect. Agents use it while they work, and run the full suite once before the pull request. Each API test worker copies the template database once, and empties it before each e2e test. The e2e project keeps the app modules loaded from one test file to the next.

## Why

Agents ran the whole suite after every change. Most of those runs tested code the branch never touched.

- `vitest --changed origin/main` runs the tests that import a changed file. Vitest cannot see the setup files, the schema built from every entity, the config nor the dependencies. So `forceRerunTriggers` lists them: a change to one of them runs every test. Setting `forceRerunTriggers` replaces Vitest's defaults, so the list includes `package.json` and `vitest.config.ts` again.
- Copying the template for each test, then dropping the copy, cost about 120 ms per test. Emptying a database that already exists costs about 25 ms. PostgreSQL copies one database at a time, so with many workers the copies also wait for each other: about 200 ms per copy with 7 workers on another Lonestone project.
- With `isolate: true`, Vitest reloads every app module for each test file. On the boilerplate it cost about 4 s between the two e2e files on a slow machine. On another Lonestone project, the two changes together took its e2e suite from 55 s to 19 s.

What a test sees does not change: each e2e test starts from empty tables, with its own app.

## Applies When

- `createTestOrm` in `apps/api/src/test/helpers/test-db.helper.ts` copies `TEMPLATE_DB_NAME` (intention `unreleased/api-tests-template-database` applied).
- The API tests run with Vitest.

## Do Not Apply When

- `.boilerstone/migration-intentions/` exists. This is the boilerplate repository, or a fork that publishes its own intentions. Record as skipped.
- Some entity has a numeric key from a sequence and some test relies on its value. Emptying a table does not reset its sequence. Skip gap 3 only, and record why.

## Observable Gaps

1. **`test:changed` scripts** — signal: `rg '"test:changed"' package.json apps/api/package.json` finds nothing.
   Add the script to the root `package.json` and to each workspace package that runs Vitest, as in the staged files. Keep `--changed origin/main` unless the project's main branch has another name.
   Done when: `pnpm test:changed` runs no test on a clean branch based on `origin/main`, and exits with code 0.
2. **Rerun triggers** — signal: `rg "forceRerunTriggers" apps/api/vitest.config.ts` finds nothing.
   Copy the `forceRerunTriggers` list from the staged `apps/api/vitest.config.ts`. Add the project's own files that every test depends on but no test imports (shared fixtures, other setup files).
   Done when: a one-line change in `apps/api/src/test/setup/test.setup.ts` makes `pnpm --filter=api test:changed` run every test.
3. **One database per worker** — signal: `rg "test_worker_" apps/api/src/test/helpers/test-db.helper.ts` finds nothing.
   Copy `ensureWorkerDatabase`, `emptyWorkerDatabase`, `createTestOrm` and `cleanupTestOrm` from the staged `test-db.helper.ts`.
   Done when: `rg "DROP DATABASE" apps/api/src/test/helpers/test-db.helper.ts` finds nothing and the e2e tests pass.
4. **Agent rule** — signal: `rg "test:changed" AGENTS.md` finds nothing.
   Add the `Tests:` line from the staged `AGENTS.md`, and the "When to run what" part of the staged testing guide to the project's own testing doc. Point the line at that doc.
   Done when: `rg "test:changed" AGENTS.md` matches.
5. **No module reload between e2e files** — signal: `rg "isolate: false" apps/api/vitest.config.ts` finds nothing.
   Add `isolate: false` to the e2e project. Before that, check that no e2e file uses `vi.mock`, fake timers, or changes `process.env` without restoring it: the next file in the same worker would see it.
   Done when: `rg "isolate: false" apps/api/vitest.config.ts` matches and the e2e tests pass twice in a row.

## Out of Scope

- The CI workflows. The CI still runs every test.
- The test files themselves (`*.e2e-spec.ts`, `*.spec.ts`).
- The worker count (`maxWorkers`). The boilerplate has two e2e files, so the longest one sets the time. A project with many e2e files can try `maxWorkers: '50%'`: on another Lonestone project, more than 4 workers on 8 cores gained nothing.
- `STRATEGY FILE_COPY` on the template copy. With one copy per worker, the copy strategy no longer matters.

## Reference Paths

- `package.json` — **adapt**
- `apps/api/package.json` — **adapt**
- `apps/api/vitest.config.ts` — **adapt**
- `apps/api/src/test/helpers/test-db.helper.ts` — **adapt**
- `AGENTS.md` — **adapt**
- `apps/documentation/src/content/docs/guides/api-testing.mdx` — **adapt**

## Validation

- `pnpm --filter=api typecheck` passes.
- `pnpm test` passes, with every e2e test green.
- `pnpm test:changed` after a one-line change in one module's service runs only that module's tests.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/api-tests-changed-and-worker-database --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
