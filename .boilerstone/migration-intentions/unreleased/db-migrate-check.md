---
id: unreleased/db-migrate-check
domain: api
classification: migration
---

# Check the MikroORM snapshot before creating a migration

## Goal

The API has a `db:migrate:check` script, and the agent rules require it to report no changes before an entity changes.

## Why

After `migration:up` or `migration:down`, MikroORM rewrites the snapshot from the migrated database whenever the two differ. A local database that drifted from the entities (a `db:sync`, tables left by another branch, a migration written from scratch, a rollback) drags the snapshot with it. The next `migration:create` then holds hundreds of unrelated lines, and an agent tends to trim them by hand, which leaves the snapshot wrong and brings the changes back next time. `migration:check` detects the drift before anyone writes a migration, and the documented fix rebuilds the snapshot once from the entities.

## Applies When

- The API uses `@mikro-orm/migrations` with snapshots on (the default).

## Do Not Apply When

- The project turned snapshots off (`migrations.snapshot: false`).
- The project does not use MikroORM migrations.

## Observable Gaps

1. **Script** — signal: `apps/api/package.json` has no `db:migrate:check` script.
   Add `"db:migrate:check": "npx mikro-orm migration:check"` next to `db:migrate:create`, as in the staged reference.
   Done when: `pnpm --filter=api db:migrate:check` runs.
2. **Agent rule** — signal: the project's backend guidelines have no `### Migrations` section under `## Database`.
   Copy the section from the staged reference, adapting the package filter if the API package is not named `api`. If the project keeps its agent rules in `AGENTS.md` or `CLAUDE.md` instead, put the same rule there.
   Done when: the rule "never write a migration file from scratch, run `db:migrate:check` before touching an entity" is in a file agents read.
3. **Clean snapshot** — signal: `pnpm --filter=api db:migrate:check` reports changes on the default branch.
   Follow "When the snapshot drifts" in the staged reference `6_database-migrations.mdx`.
   Done when: `pnpm --filter=api db:migrate:check` reports no changes.

## Out of Scope

- The existing migrations, except the one the drift fix may produce.
- The entities.

## Reference Paths

- `apps/api/package.json` — **adapt**
- `apps/documentation/src/content/docs/references/backend.mdx` — **adapt**
- `apps/documentation/src/content/docs/explanations/6_database-migrations.mdx` — **adapt**

## Validation

- `pnpm --filter=api db:migrate:check` reports no changes.
- `pnpm typecheck` passes.

## Record Result

Run `pnpm boilerplate upgrade record --id vX.Y.Z/db-migrate-check --applied` after validation passes, or record it as skipped with a reason.
