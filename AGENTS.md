# AGENTS.md

Guidance for AI agents working in this repo.

## Project Overview
- TypeScript monorepo with NestJS + MikroORM + PostgreSQL backend, React 19 (SPA + SSR) frontend, shadcn/ui, Tailwind, TanStack Query, automatic OpenAPI typing.

## Essential Commands
### Setup & Development
- `pnpm rock` – interactive project setup.
- `pnpm dev` – start all apps (auto-regenerates OpenAPI types).
- `pnpm --filter=api dev` – API only.
- `pnpm --filter=web-spa dev` – SPA only.
- `pnpm --filter=web-ssr dev` – SSR app only.

### Build & Quality
- `pnpm build` – build all applications.
- `pnpm lint` / `pnpm lint:fix` – lint (optionally autofix).
- `pnpm typecheck` – type checking.

### Docker Services
- `pnpm docker:up` / `pnpm docker:down` / `pnpm docker:logs` – Postgres, MailDev, MinIO stack.

### Database (API)
- From `apps/api`: `pnpm db:fresh`, `pnpm db:fresh:seed` (dev sync).
- Migration flow: `pnpm db:migrate:create`, `pnpm db:migrate:up`, `pnpm db:migrate:down`, `pnpm db:migrate:fresh`, `pnpm db:migrate:seed`. Review generated SQL; commit `.snapshot.json`.

### Type Generation
- `pnpm generate` – build OpenAPI SDK/types (`packages/openapi-generator/client/`; commit results). `pnpm dev` also regenerates when API is running.

### Module Generation
- `pnpm schematics:module` – scaffold API module (controller, service, entity, contracts, tests).

### Testing
- `pnpm test` – all tests.
- From `apps/api`: `pnpm test`, `pnpm test:watch`, or `pnpm test -- path/to/test.spec.ts`.

## Code & Architecture Guidelines
### Naming & Imports
- Files/dirs kebab-case; classes/interfaces/types PascalCase; functions/vars camelCase; constants UPPER_SNAKE_CASE; booleans start with is/has/can; handlers use handle*; hooks use use*.
- Import order: external libs → `@lonestone/*` packages → local relative.

### TypeScript
- Avoid `any`; prefer interfaces to types.
- Export inferred Zod types (`type User = z.infer<typeof userSchema>`).

### Backend (NestJS + MikroORM)
- Module shape: controller, service, entity (or entities/), contracts/.
- Use `@TypedRoute.*`, `@TypedBody`, `@TypedParam` decorators.
- Zod schemas must include `.meta()` for OpenAPI docs.
- Follow migration workflow; review SQL; commit `.snapshot.json`.

### Frontend (React)
- Use `@lonestone/ui` components; Lucide icons only.
- TanStack Query options live in `features/*/utils/*-queries.ts`.
- Forms: React Hook Form + Zod.
- Use i18n `t()` for user-facing strings (no hardcoding).
- Import SDK/types from `@boilerstone/openapi-generator`.

### Full-Stack Flow
- Define Zod contracts in API → OpenAPI spec → `pnpm generate` produces SDK/types → frontends consume from `@boilerstone/openapi-generator`.

### Error Handling & Testing
- Use exceptions for unexpected errors; add context when catching.
- Prefer global/unhandled error handlers where appropriate.
- Tests follow Arrange–Act–Assert; name vars inputX/mockX/actualX/expectedX; cover public functions with doubles for deps.

## Documentation
- Helpful references: `apps/documentation/src/content/docs/guidelines/backend.mdx`, `.../frontend.mdx`, `.../explanations/1_architecture.mdx`, `.../explanations/6_database_migrations.mdx`, `apps/api/README.md`. Run `pnpm docs-only` to view docs site.
