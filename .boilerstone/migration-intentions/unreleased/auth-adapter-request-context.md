---
id: unreleased/auth-adapter-request-context
domain: auth
classification: migration
---

# Auth Adapter Request Context

## Goal

Every database operation of the local Better Auth MikroORM adapter (`apps/api/src/modules/auth/auth-db.adapter.ts`) runs under `@EnsureRequestContext()`, so `orm.em` resolves to a usable fork whether or not the caller has an ambient MikroORM context.

## Why

The adapter called `orm.em` directly. Inside an HTTP handler that resolves to the request-scoped fork through the MikroORM Nest middleware, so it worked. Outside one it stays the global instance, and MikroORM refuses context-specific work with `Using global EntityManager instance methods for context specific actions is disallowed`.

Better Auth is not only called from HTTP handlers. A WebSocket gateway resolving a session from the upgrade request, a scheduled task, or a queue worker all reach the adapter with no ambient context, and every query throws. Raising `allowGlobalContext` would silence the error by sharing one identity map across concurrent callers, which is what the option exists to prevent. Wrapping each non-HTTP entry point in a request context puts the burden on every call site, and an adapter that only works under one kind of caller is the thing to fix.

MikroORM ships the decorator for exactly this: `@EnsureRequestContext()` reuses the request fork when there is one, prefers the surrounding `TransactionContext` when the call happens inside `em.transactional` (a hand-rolled `RequestContext.getEntityManager() ?? orm.em.fork()` forks alongside the transaction instead of joining it), and opens a context for the operation otherwise. Inside the method `orm.em` then resolves to that one fork for the whole body, so `persist` and `flush` stay on the same instance and `normalizeInput` does not need the manager threaded in.

The decorator only applies to class members, so the adapter operations move off the object literal returned by `adapter(config)` onto a class. `createAdapterFactory` calls them as methods, so `this` is preserved and the factory needs no change beyond `adapter: (config) => new MikroOrmAuthAdapter(orm, config)`.

## Applies When

- The project uses Better Auth on the local MikroORM adapter (`v1.0.0/align-better-auth-mikro-orm-adapter` applied, or `auth-db.adapter.ts` present).
- The adapter operations in `auth-db.adapter.ts` are not wrapped in `@EnsureRequestContext()`: they call `orm.em` directly, or go through a hand-rolled helper resolving the entity manager.

## Do Not Apply When

- The project has no API app, or does not use Better Auth.
- Auth persistence is not the local MikroORM adapter (a `pg` pool, Drizzle, Prisma) — that is `v1.0.0/align-better-auth-mikro-orm-adapter`, not this intention.
- The project deliberately runs the ORM with `allowGlobalContext: true` and a human confirms it wants to keep the global identity map — record as skipped with that reason.

## Observable Gaps

1. **Adapter shape** — signal: the `adapter(config)` callback in `mikroOrmAdapter` returns an object literal of operations.
   Move the operations onto a `MikroOrmAuthAdapter` class as in the staged reference: the constructor takes `(orm, config)`, keeps `orm` on a property (the decorator resolves the entity manager from `this.orm`) and builds the utils once. `adapter` becomes `(config) => new MikroOrmAuthAdapter(orm, config)`. Keep the project's own adapter deltas (entity-name overrides, extra options).
   Done when: `createAdapterFactory` receives a class instance and no operation lives on an object literal.

2. **Context resolution** — signal: an operation body resolves an entity manager itself (`RequestContext.getEntityManager()`, `orm.em.fork()`, or a local `resolveEntityManager` helper), or none of the operations carry a decorator.
   Decorate `count`, `create`, `delete`, `deleteMany`, `findMany`, `findOne`, `update` and `updateMany` with `@EnsureRequestContext()` from `@mikro-orm/decorators/legacy` and drop the helper. `createSchema` stays undecorated: it only reads metadata and writes files.
   Done when: the file imports `EnsureRequestContext`, every database operation carries it, and no `fork()` or `RequestContext` call is left.

3. **Reference creation** — signal: `normalizeInput` in `createAdapterUtils` takes an entity manager parameter, or the file threads one through to `getReference`.
   Under the decorator `orm.em` is already the contextual fork, so `normalizeInput` closes over `orm` like the rest of `createAdapterUtils` and calls `orm.em.getReference`.
   Done when: `normalizeInput` takes `(metadata, input)` only.

## Out of Scope

- The adapter's query translation: where clauses, select, sort, and output serialization.
- Which entities back which Better Auth model, and the Better Auth configuration itself.
- Adding `allowGlobalContext` to the ORM configuration.
- Wrapping non-HTTP entry points in a request context, which stays the application's call.
- Services and gateways elsewhere in the project that resolve their own entity manager — this intention covers the auth adapter only.

## Reference Paths

- `apps/api/src/modules/auth/auth-db.adapter.ts` — **adapt**

## Validation

- `pnpm --filter=api typecheck` passes.
- `pnpm --filter=api test` passes.
- Grepping `auth-db.adapter.ts` for `RequestContext` or `fork(` returns nothing.
- A Better Auth call made outside any request context (a WebSocket handler, a scheduled task) reads and writes without the global-context error, with `allowGlobalContext` unset.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/auth-adapter-request-context --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
