---
id: v1.0.0/align-better-auth-mikro-orm-adapter
domain: auth
classification: migration
---

# Align Better Auth MikroORM Adapter

## Goal

Align a consumer project's Better Auth MikroORM adapter with the v1.0.0 boilerplate baseline.

## Why

The v1.0.0 boilerplate includes Better Auth integration backed by MikroORM. Projects that already use Better Auth may need adapter and test-helper updates to match the baseline safely.

## Applies When

- The project uses Better Auth.
- The project stores auth state through MikroORM entities or an adapter derived from the boilerplate.
- The project tracks the `auth` domain.

## Do Not Apply When

- The project does not use Better Auth.
- The project uses another auth provider or a custom persistence layer.
- The project has customized auth semantics that conflict with the boilerplate adapter.

## Reference Paths

- `apps/api/src/modules/auth/`
- `apps/api/src/modules/db/`
- `apps/api/src/test/`

## Suggested Agent Workflow

1. Identify the project's auth provider and persistence adapter.
2. Compare the adapter behavior, entity mappings, and tests with the v1.0.0 reference.
3. Apply only the compatibility changes that preserve existing users, sessions, and account semantics.
4. Do not rename or drop auth tables without a human-approved migration plan.
5. Stop if the project has custom login, organization, or permission behavior that the baseline does not cover.

## Validation

- Auth adapter tests pass if available.
- `pnpm --filter=api typecheck` passes.
- Existing auth flows still work in the project's test suite.

## Record Result

Run `pnpm boilerplate upgrade record --id v1.0.0/align-better-auth-mikro-orm-adapter --applied` after validation passes, or record it as skipped with a reason.
