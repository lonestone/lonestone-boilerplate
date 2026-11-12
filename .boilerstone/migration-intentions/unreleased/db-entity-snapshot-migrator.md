---
id: unreleased/db-entity-snapshot-migrator
domain: api
classification: migration
---

# Spell the MikroORM migration snapshot like the entities

## Goal

After a migration run, the MikroORM snapshot is written in the entities' form whenever the database matches them, and from the database otherwise.

## Why

After `migration:up` or `migration:down`, MikroORM 7 rewrites the snapshot from the migrated database whenever the two differ, which happens after any hand-written migration or rollback. That keeps the next `migration:create` honest after a rollback, so it must stay. But an introspected snapshot spells every index with its `CREATE INDEX` expression, so the next `migration:create` rewrites hundreds of snapshot lines back from the entities: the diff hides the real change and the snapshot flips between two formats. When the migrated database holds exactly what the entities declare, the two spellings mean the same thing, so the entities' one is written.

## Applies When

- The API uses `@mikro-orm/migrations` 7 with snapshots on (the default).
- The MikroORM config registers `Migrator` from `@mikro-orm/migrations` in `extensions`.

## Do Not Apply When

- The project turned snapshots off (`migrations.snapshot: false`).
- The project does not use MikroORM migrations.

## Observable Gaps

1. **Migrator subclass** — signal: `apps/api/src/modules/db/entity-snapshot-migrator.ts` is missing.
   Copy it from the staged reference. The class must keep the name `Migrator`: MikroORM adds its own migrator when no extension carries that class name, and the last one registered wins. Never make it write the entities unconditionally: after a rollback, `migration:create` would then miss the rolled-back change.
   Done when: the file exists and exports `Migrator`.
2. **Config** — signal: the MikroORM config imports `Migrator` from `@mikro-orm/migrations`.
   Import it from `./entity-snapshot-migrator` instead, keeping it in `extensions`.
   Done when: no file outside `entity-snapshot-migrator.ts` imports `Migrator` from `@mikro-orm/migrations`.
3. **Snapshot format** — signal: `grep -c '"expression": "CREATE' apps/api/src/modules/db/migrations/.snapshot-*.json` returns more than 0 (an index the entities declare with an `expression` is spelled in lowercase, `create index`).
   Regenerate the snapshot from the entities once: add a throwaway column to any entity, run `pnpm db:migrate:create`, keep the new snapshot, then revert the column and delete the throwaway migration.
   Done when: `npx mikro-orm migration:check` reports no changes and the snapshot carries an `expression` only on the indexes the entities declare with one.

## Out of Scope

- The migrations themselves and the database schema: this changes no SQL.
- Index declarations in the entities.

## Reference Paths

- `apps/api/src/modules/db/entity-snapshot-migrator.ts` — **copy**
- `apps/api/src/modules/db/db.config.ts` — **adapt**

## Validation

- `pnpm typecheck` passes.
- `npx mikro-orm migration:check` (in `apps/api`) reports no changes.
- After `migration:down`, `migration:create --dump` regenerates the rolled-back change. Delete that migration file.
- After `migration:up` back, `git diff` on the snapshot is empty.

## Record Result

Run `pnpm boilerplate upgrade record --id vX.Y.Z/db-entity-snapshot-migrator --applied` after validation passes, or record it as skipped with a reason.
