---
id: unreleased/backend-guide-transactions-seeders-tests
domain: api
classification: migration
---

# Correct the backend guide on transactions, and add the test, seeder and collection rules

## Goal

The project's backend guide (`apps/documentation/src/content/docs/references/backend.mdx`) no longer says that a controller request runs in a transaction, and it carries the rules for transactions, collections, seeders and test data.

## Why

The guide said MikroORM wraps each controller operation in a transaction by default. That is false: the request context only gives each request its own EntityManager, and each `flush()` opens its own transaction. Agents followed the sentence and wrapped code in `em.transactional` everywhere. The same guide gave no rule for replacing a collection, for what a seeder is for, or for how a test gets its data, so a project wrote those by hand and in different ways.

## Applies When

- The project has `apps/documentation/src/content/docs/references/backend.mdx`.
- That file still contains `MikroORM wraps each operation in a transaction by default`.

## Do Not Apply When

- The project replaced the backend guide with its own. Record as skipped with that reason.

## Observable Gaps

1. **False transaction sentence** — signal: `rg "wraps each operation in a transaction" apps/documentation/src/content/docs/references/backend.mdx` matches.
   Replace it with the three bullets of the staged reference (transactions, `@Transactional()`, collections).
   Done when: the `rg` returns nothing.

2. **Seeder and test rules** — signal: the guide has no `### Seeders` heading and no bullet about arrange, act and assert in `## Testing`.
   Add them from the staged reference.
   Done when: both are present.

## Out of Scope

- The project's services, seeders and tests. Rewriting them to follow the rules is a follow-up the team chooses.
- The other sections of the guide.

## Reference Paths

- `apps/documentation/src/content/docs/references/backend.mdx` — **adapt**

## Validation

- `pnpm --filter @boilerstone/documentation build` passes (use the project's package name).

## Record Result

Run `pnpm boilerplate upgrade record --id vX.Y.Z/backend-guide-transactions-seeders-tests --applied` after validation passes, or record it as skipped with a reason.
