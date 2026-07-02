# Change Classification - v1.0.0

## No Migration

- Initial monorepo baseline: API, SPA, SSR frontend, documentation app, shared UI package, i18n package, OpenAPI generator, and schematics package.
- Backend baseline: NestJS, MikroORM/PostgreSQL, Better Auth, email, file storage, AI helpers, monitoring/tracing, and example modules.
- Frontend baseline: React applications, shared UI primitives, authentication screens, example feature flows, and generated API contracts.
- Development baseline: PNPM workspace scripts, Docker Compose services, oxlint/oxfmt, Vitest, documentation tooling, and CI/CD templates.
- Initial `.boilerstone/` upgrade system: state schema, CLI, docs, and tests.
- `install.sh` lifecycle entry point: `init`, `onboard`, and `upgrade`.
- Human-supervised AI workflow docs and shims for Claude Code and Cursor.
- Safe recording commands: `upgrade record`, `upgrade finish`, and `intentions lint`.

## Informational

- [setup-boilerplate-tracking](./setup-boilerplate-tracking.md): bootstrap initializes `.boilerstone/boilerplate.json` before normal upgrade paths are computed.

## Migration Intentions

- [standardize-oxlint-oxfmt](./standardize-oxlint-oxfmt.md): align lint and format tooling with the v1.0.0 Oxlint/Oxfmt baseline when the project follows boilerplate tooling.
- [migrate-mikro-orm-v7](./migrate-mikro-orm-v7.md): align a MikroORM API project with the v1.0.0 MikroORM v7 baseline.
- [align-better-auth-mikro-orm-adapter](./align-better-auth-mikro-orm-adapter.md): align Better Auth persistence when the project uses Better Auth with MikroORM.
- [adopt-ai-module-baseline](./adopt-ai-module-baseline.md): adopt AI module conventions only for projects that intentionally track the `ai` domain.

## Breaking / Manual

<!-- Changes requiring human decision or project-specific work -->
<!-- Example: "- Database schema migration required - review changes manually" -->
