---
id: unreleased/backend-guide-query-object-no-raw-sql-join-tables
domain: api
classification: migration
requires:
  - unreleased/backend-guide-transactions-seeders-tests
---

# Add three backend rules: query objects, no raw SQL, no service for a simple join table

## Goal

The project's backend guide (`apps/documentation/src/content/docs/references/backend.mdx`) carries three rules: use one `@TypedQueryObject(schema)` instead of many `@TypedQuery` decorators, use the MikroORM QueryBuilder or EntityManager instead of raw SQL, and do not create a service for a simple join table.

## Why

Controllers stacked four or five `@TypedQuery` decorators on one method. A single query object gives one validated contract instead. Raw SQL crept into queries that the QueryBuilder handles. Simple join tables got their own services, and their writes ran in separate flushes. The rules were only implied by the examples, which projects delete early, so they belong in the guide.

## Applies When

- The project has `apps/documentation/src/content/docs/references/backend.mdx`.
- That file does not mention `TypedQueryObject`.

## Do Not Apply When

- The project replaced the backend guide with its own. Record as skipped with that reason.

## Observable Gaps

1. **Query object rule** — signal: `rg "TypedQueryObject" apps/documentation/src/content/docs/references/backend.mdx` matches nothing.
   Add the bullet and its example to `### Controllers` from the staged reference.
   Done when: the `rg` matches.

2. **No raw SQL rule** — signal: the `### Queries` section has no bullet that starts with `No raw SQL`.
   Add it from the staged reference.
   Done when: the bullet is present.

3. **Join table rule** — signal: the `### Services` section has no bullet about join tables.
   Add the two bullets and the example from the staged reference.
   Done when: both are present.

## Out of Scope

- The project's controllers, queries and services. Rewriting them to follow the rules is a follow-up the team chooses.
- The other sections of the guide.

## Reference Paths

- `apps/documentation/src/content/docs/references/backend.mdx` — **adapt**

## Validation

- `pnpm --filter @boilerstone/documentation build` passes (use the project's package name).

## Record Result

Run `pnpm boilerplate upgrade record --id vX.Y.Z/backend-guide-query-object-no-raw-sql-join-tables --applied` after validation passes, or record it as skipped with a reason.
