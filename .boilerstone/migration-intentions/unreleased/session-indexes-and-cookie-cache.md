---
id: unreleased/session-indexes-and-cookie-cache
domain: auth
classification: migration
pr: 186
---

# Index session lookups and cache sessions in a cookie

## Goal

`session.userId` and `account.userId` are indexed, and Better Auth serves most session reads from a signed cookie instead of the database.

## Why

Sessions already work across several API instances: they live in the shared database and every instance signs cookies with the same `BETTER_AUTH_SECRET`. The cost is database load, and it grows with every instance added.

Each authenticated request reads the session and then the user: two queries before the controller runs. The global guard does this even on `@AllowAnonymous()` routes when the request carries a cookie. Better Auth's cookie cache keeps a signed copy of the session in a second cookie, so the API skips both queries while that cookie is valid. Measured on the API: a protected route went from two session queries to none.

The cache has a price, and it is the reason this is a decision and not a free win. A revoked session, a password reset on another device, or a user change made outside Better Auth stays visible for up to `maxAge`. The boilerplate picks 5 minutes, the usual lifetime of a short access token.

The cache only partly covers the guard. The package's guard calls `getSession()` without returning headers, so it never sends a refreshed cache cookie. The cookie is renewed at sign-in and when the frontend calls `get-session`. After it expires, requests read the database until the next such call.

The indexes are independent of the cache. `session.userId` and `account.userId` are foreign keys without an index. Listing or revoking a user's sessions, deleting a user, and loading accounts at sign-in each scan the whole table.

Rejected: Better Auth's `experimental.joins` to merge the two queries into one. The in-tree MikroORM adapter's `findOne` ignores `join`, so turning it on would break session reads. Redis `secondaryStorage` is out of scope until a project measures a need for it.

## Applies When

- The project has the `api` app and uses Better Auth with the in-tree MikroORM adapter.
- `apps/api/src/modules/auth/auth.config.ts` has no `session.cookieCache` block.
- `apps/api/src/modules/auth/entities/session.entity.ts` or `account.entity.ts` has no `@Index()` on `user`.

## Do Not Apply When

- The project has no `api` app or does not use Better Auth.
- The project needs instant session revocation (for example, a ban must take effect on the next request). Apply only the indexes and record the cache as skipped with that reason.
- The project already stores sessions in a `secondaryStorage` such as Redis.

## Observable Gaps

1. **Session index** — signal: `apps/api/src/modules/auth/entities/session.entity.ts` has no `@Index()` on the `user` relation.
   Align with the staged reference entity.
   Done when: the entity has `@Index()` on `user`.

2. **Account index** — signal: `apps/api/src/modules/auth/entities/account.entity.ts` has no `@Index()` on the `user` relation.
   Align with the staged reference entity.
   Done when: the entity has `@Index()` on `user`.

3. **Index migration** — signal: no migration creates `session_userId_index` or `account_userId_index`.
   Generate the project's own migration with `pnpm --filter=api db:migrate:create`. Keep only the two `create index` lines and their `drop index` counterparts; delete any unrelated diff the generator adds. Do not copy the boilerplate's migration file. On a large production `session` table, a plain `create index` blocks writes while it builds: use `create index concurrently` in a migration that overrides `isTransactional()` to return `false`.
   Done when: `pnpm --filter=api db:migrate:up` applies it and `pg_indexes` lists both indexes.

4. **Cookie cache** — signal: `rg "cookieCache" apps/api/src/modules/auth/auth.config.ts` finds nothing.
   Add `session: { cookieCache: { enabled: true, maxAge: 5 * 60 } }` to the options of `createBetterAuth()`. Keep every other option the project has.
   Done when: after sign-in, the response sets a `better-auth.session_data` cookie.

5. **Documentation** — signal: `apps/documentation/src/content/docs/core-features/1_auth.mdx` has no `## Sessions` section.
   Align with the staged reference page.
   Done when: the section explains the cache delay and the guard limit.

## Out of Scope

- The other Better Auth options in `createBetterAuth()`, including `rateLimit`.
- The MikroORM adapter and the schema codegen.
- The frontend auth client.
- Cleaning up expired sessions.

## Reference Paths

- `apps/api/src/modules/auth/entities/session.entity.ts` — **adapt**
- `apps/api/src/modules/auth/entities/account.entity.ts` — **adapt**
- `apps/api/src/modules/auth/auth.config.ts` — **adapt**
- `apps/documentation/src/content/docs/core-features/1_auth.mdx` — **adapt**

## Validation

- `pnpm --filter=api typecheck` passes.
- `pnpm --filter=api test` passes.
- `pnpm lint` passes.
- With the API running and query logging on: after sign-in, a protected route returns 200 and logs no query on `session` or `user`. With only the `session_token` cookie, the same route logs both queries.

## Record Result

Run `pnpm boilerplate upgrade record --id <release>/session-indexes-and-cookie-cache --applied` after validation passes, or record it as skipped with a reason.
