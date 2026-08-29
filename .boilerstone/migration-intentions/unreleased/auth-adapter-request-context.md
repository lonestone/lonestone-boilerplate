---
id: unreleased/auth-adapter-request-context
domain: auth
classification: migration
---

# Auth Adapter Request Context

## Goal

Every operation of the local Better Auth MikroORM adapter (`apps/api/src/modules/auth/auth-db.adapter.ts`) runs on a context-safe entity manager: the contextual one inside a request, a dedicated fork outside one.

## Why

The adapter called `orm.em` directly. Inside an HTTP handler that resolves to the request-scoped fork through the MikroORM Nest middleware, so it worked. Outside one it stays the global instance, and MikroORM refuses context-specific work with `Using global EntityManager instance methods for context specific actions is disallowed`.

Better Auth is not only called from HTTP handlers. A WebSocket gateway resolving a session from the upgrade request, a scheduled task, or a queue worker all reach the adapter with no ambient context, and every query throws. Raising `allowGlobalContext` would silence the error by sharing one identity map across concurrent callers, which is what the option exists to prevent.

The entity manager is resolved once per adapter operation, not once per call site, so `persist` and `flush` stay on the same instance.

## Applies When

- The project uses Better Auth on the local MikroORM adapter (`v1.0.0/align-better-auth-mikro-orm-adapter` applied, or `auth-db.adapter.ts` present).
- `auth-db.adapter.ts` calls `orm.em` inside its adapter operations, or `normalizeInput` calls `orm.em.getReference`.

## Do Not Apply When

- The project has no API app, or does not use Better Auth.
- Auth persistence is not the local MikroORM adapter (a `pg` pool, Drizzle, Prisma) — that is `v1.0.0/align-better-auth-mikro-orm-adapter`, not this intention.
- The project deliberately runs the ORM with `allowGlobalContext: true` and a human confirms it wants to keep the global identity map — record as skipped with that reason.

## Observable Gaps

1. **Entity manager resolution** — signal: `auth-db.adapter.ts` has no helper resolving the entity manager, and grepping it for `orm.em` returns hits outside a single `fork()` call.
   Add the `resolveEntityManager` helper from the staged reference and call it once at the top of `count`, `create`, `delete`, `deleteMany`, `findMany`, `findOne`, `update` and `updateMany`. Keep the project's own adapter deltas (entity-name overrides, extra options).
   Done when: the only `orm.em` left in the file is inside the helper.

2. **Reference creation** — signal: `normalizeInput` in `createAdapterUtils` calls `orm.em.getReference`.
   Thread the operation's entity manager through `normalizeInput` as in the staged reference. `getReference` touches the identity map, so it throws on the global instance like any other operation.
   Done when: `normalizeInput` takes an entity manager and `createAdapterUtils` no longer closes over `orm.em`.

3. **Write consistency** — signal: `create`, `update` or `delete` call `persist`, `assign`, `remove` and `flush` on separately resolved managers.
   Resolve once per operation and reuse that instance for the whole operation.
   Done when: each operation body references a single `em` binding.

## Out of Scope

- The adapter's query translation: where clauses, select, sort, and output serialization.
- Which entities back which Better Auth model, and the Better Auth configuration itself.
- Adding `allowGlobalContext` to the ORM configuration.
- Wrapping non-HTTP entry points in a request context, which stays the application's call.

## Reference Paths

- `apps/api/src/modules/auth/auth-db.adapter.ts` — **adapt**

## Validation

- `pnpm --filter=api typecheck` passes.
- Auth adapter tests pass if available.
- Grepping `auth-db.adapter.ts` for `orm.em` returns only the helper's `fork()` call.
- A Better Auth call made outside any request context (a WebSocket handler, a scheduled task) reads and writes without the global-context error, with `allowGlobalContext` unset.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/auth-adapter-request-context --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
