---
id: unreleased/lint-one-entity-per-file
domain: tooling
classification: migration
requires:
  - v1.0.0/standardize-oxlint-oxfmt
pr: 197
---

# Fail the lint when an entity file declares several classes

## Goal

Every `apps/api/**/*.entity.ts` declares at most one class, and oxlint fails when one declares more.

## Why

MikroORM discovers entities by importing each compiled `*.entity.js` as an ES module. Node cannot read the named exports of a compiled file that exports several classes, so every entity in that file is skipped without a warning (#192). It only surfaces at runtime, as `MetadataError: Metadata for entity X not found`, when no other entity points at the skipped one.

The backend reference states the rule since #192, but nothing enforced it: a generated project grouped three entities in one file, and two review passes missed it.

## Applies When

- The project tracks the `tooling` domain and lints with oxlint (`.oxlintrc.json` exists).
- The project has the `api` app.

## Do Not Apply When

- The project lists its entities by hand instead of discovering them from `*.entity.js` files, and a human decided to keep several classes per file. Record as skipped with that reason.

## Observable Gaps

1. **Lint rule** — signal: `.oxlintrc.json` has no override setting `eslint/max-classes-per-file` for `apps/api/**/*.entity.ts`.
   Add the override from the staged reference to the project's `overrides`; leave the other rules as they are.
   Done when: a scratch `apps/api/src/scratch.entity.ts` with two exported classes makes `pnpm lint` fail on `max-classes-per-file`. Delete the scratch file.

2. **Entity files** — signal: `pnpm lint` reports `max-classes-per-file` on an existing entity file.
   Split it like `apps/api/src/modules/posts/`: one class per file under `<module>/entities/<name>.entity.ts`, and keep the old file as a re-export so imports do not change. Type a relation to an entity of a sibling file as `Rel<…>` when the import is circular.
   Done when: `pnpm lint` reports no `max-classes-per-file`.

## Out of Scope

- Entity fields, relations and migrations: splitting a file changes no table, so `migration:create` must produce an empty diff.
- Classes in files that are not `*.entity.ts`.

## Reference Paths

- `.oxlintrc.json` — **adapt**
- `apps/api/src/modules/posts/` — **adapt**

## Validation

- `pnpm lint` passes.
- `pnpm typecheck` passes.
- The API starts, and `pnpm --filter=api db:migrate:create` reports no change.
- The API tests pass.

## Record Result

Run `pnpm boilerplate upgrade record --id vX.Y.Z/lint-one-entity-per-file --applied` after validation passes, or record it as skipped with a reason.
