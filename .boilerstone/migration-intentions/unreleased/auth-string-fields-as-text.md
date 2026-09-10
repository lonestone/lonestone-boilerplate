---
id: unreleased/auth-string-fields-as-text
domain: auth
classification: migration
---

# Generate Better Auth string columns as PostgreSQL text

## Goal

`auth generate` emits `@Property({ type: 'text' })` for every Better Auth `type: "string"` field, and any already-generated JWKS `publicKey` / `privateKey` columns are unbounded `text` rather than `varchar(255)`.

## Why

Better Auth schema fields of `type: "string"` have no length. MikroORM's default string mapping is `varchar(255)`. Encrypted JWKS private keys, OAuth tokens, and passkey material already exceed 255 characters, so `GET /api/auth/get-session` after enabling the `jwt` plugin inserts into `jwks` and rolls back with `value too long for type character varying(255)`.

Drizzle and Prisma adapters store these fields as unbounded text. A per-field heuristic (text only for JWKS, varchar for email) was rejected because Better Auth does not publish lengths, so the mapping would drift as plugins add tables. PostgreSQL stores `text` and unconstrained `varchar` the same way; `varchar(255)` only adds a truncation check.

`auth generate` still only inserts missing models and fields. It does not rewrite an existing `@Property()`. New string fields become `text`; already-generated User / Session / Account / Verification columns stay `varchar(255)` until patched by hand. This intention therefore patches codegen for the future, and JWKS if that table already exists. It does not mass-convert the other auth tables.

## Applies When

- The project has `apps/api/src/modules/auth/auth-schema-codegen.ts`.
- The API uses the in-tree Better Auth MikroORM adapter (`pnpm -F api auth:generate`).

## Do Not Apply When

- The project has no `api` app.
- Auth does not go through this MikroORM adapter (a different ORM, or Better Auth's Kysely adapter).
- A human has reviewed this intention and decided to keep `varchar(255)` on generated auth strings — record as skipped with that reason.

## Observable Gaps

1. **Codegen string mapping** — signal: `apps/api/src/modules/auth/auth-schema-codegen.ts` has no `if (stringType === 'string') options.push("type: 'text'")` next to the existing `json` / `array` mappings.
   Copy that branch from the staged reference. Keep project-specific mappings for other Better Auth types.
   Done when: `rg "type: 'text'" apps/api/src/modules/auth/auth-schema-codegen.ts` matches the string-type branch and `pnpm -F api test src/modules/auth/auth-schema-codegen.spec.ts` passes.

2. **Codegen unit tests** — signal: `apps/api/src/modules/auth/auth-schema-codegen.spec.ts` is missing, or `renderProperty` is not exported.
   Align the spec and the `renderProperty` export with the staged reference.
   Done when: the spec asserts required string → `type: 'text'`, optional string → `nullable: true`, and a `defaultValue` still keeps `type: 'text'`.

3. **JWKS key columns** — signal: `apps/api/src/modules/auth/entities/jwks.entity.ts` exists and `publicKey` / `privateKey` use `@Property()` with no `type: 'text'`.
   Add `type: 'text'` on those two properties only. Create a MikroORM migration if the table already exists in the database.
   Done when: both properties are `@Property({ type: 'text' })`. Skip this gap if the file does not exist (jwt plugin never generated).

## Out of Scope

- Mass-converting User, Session, Account, Passkey, or Verification string columns to `text`.
- Enabling the Better Auth `jwt` plugin.
- Changing JSON or array mappings in the codegen.

## Reference Paths

- `apps/api/src/modules/auth/auth-schema-codegen.ts` — **adapt**
- `apps/api/src/modules/auth/auth-schema-codegen.spec.ts` — **adapt**
- `apps/api/src/modules/auth/entities/jwks.entity.ts` — **adapt** (only if the consumer already generated it)

## Validation

- `pnpm -F api test src/modules/auth/auth-schema-codegen.spec.ts src/modules/auth/auth-db.adapter.spec.ts` passes.
- `pnpm lint` passes.
- If JWKS was patched, `pnpm --filter=api db:migrate:create` produces a migration that alters `publicKey` and `privateKey` to `text`.

## Record Result

Run `pnpm boilerplate upgrade record --id unreleased/auth-string-fields-as-text --applied` after validation passes, or record it as skipped with a reason. The id stays `unreleased/…` until the boilerplate release promotes it.
