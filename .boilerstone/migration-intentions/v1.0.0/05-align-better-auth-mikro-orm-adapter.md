---
id: v1.0.0/align-better-auth-mikro-orm-adapter
domain: auth
classification: migration
requires:
  - v1.0.0/migrate-mikro-orm-v7
---

# Align Better Auth MikroORM Adapter

## Goal

The project's Better Auth integration uses the v1.0.0 MikroORM adapter baseline: the local `mikroOrmAdapter`, schema-codegen-aligned entities, and the reference adapter behavior.

## Why

The v1.0.0 boilerplate backs Better Auth with a local MikroORM adapter (`auth-db.adapter.ts`) plus a schema codegen (`auth-schema-codegen.ts`) that keeps auth entities in sync. Projects on an earlier adapter revision miss fixes and drift from the entity schema, which breaks when other `auth` or `api` intentions land.

## Applies When

- The project uses Better Auth.
- The project stores auth state through MikroORM entities or an adapter derived from the boilerplate.
- The project tracks the `auth` domain.

## Do Not Apply When

- The project does not use Better Auth, or uses another auth provider or persistence layer — record as skipped.
- The project has customized auth semantics (login flows, organizations, permissions) that conflict with the baseline adapter (stop and ask).
- Closing a gap would rename or drop auth tables/columns — stop; that needs a human-approved data migration plan.

## Observable Gaps

Auth state is production user data: prefer stopping over guessing, and never touch stored data. Work through each gap independently; skip any that is already closed.

1. **Adapter implementation** — signal: the project's adapter predates the staged reference `auth-db.adapter.ts` (missing fixes, diverging query behavior), or auth is wired through something other than the local `mikroOrmAdapter`.
   Diff the project's adapter against the staged reference first. No project delta → copy the reference verbatim. Otherwise port only the reference-side hunks, without changing table or column names, and keep project-specific query behavior that tests depend on.
   Done when: the adapter unit tests (the `auth-db.adapter*.spec.ts` pattern) pass, `pnpm --filter=api typecheck` passes, and the diff against the staged reference is empty or every remaining delta is project-specific and named.

2. **Entities vs schema codegen** — signal: the project's auth entities diverge from what `auth-schema-codegen.ts` generates for its Better Auth config.
   Regenerate and compare; apply only additive or neutral differences. Any rename/drop is a stop condition (see above).
   Done when: entities match the codegen output for the project's plugins, with no destructive schema change.

3. **Better Auth config** — signal: the adapter-related options in `auth.config.ts` (adapter wiring, plugin list affecting persistence) drift from the staged reference.
   Align only persistence-related options. Keep the project's providers, hooks, session settings, and plugins.
   Done when: existing auth flows pass in the project's test suite.

## Out of Scope

- Stored users, sessions, and accounts — never migrated or rewritten by this intention.
- Auth table/column renames or drops.
- The project's login/organization/permission business logic and provider configuration.

## Reference Paths

- `apps/api/src/modules/auth/`
- `pnpm-workspace.yaml`

## Validation

- Auth adapter tests pass if available.
- `pnpm --filter=api typecheck` passes.
- Existing auth flows still work in the project's test suite.

## Record Result

Run `pnpm boilerplate upgrade record --id v1.0.0/align-better-auth-mikro-orm-adapter --applied` after validation passes, or record it as skipped with a reason.
