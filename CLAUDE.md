# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript monorepo boilerplate for full-stack web applications using:

- **Backend**: NestJS + MikroORM + PostgreSQL + Better Auth
- **Frontend**: React 19 + React Router v7 + TanStack Query + Tailwind CSS + shadcn/ui
- **Full-stack typing**: Automatic OpenAPI type generation from backend to frontend

## Essential Commands

### Setup & Development

```bash
# Initial setup (interactive configuration)
pnpm rock

# Start all apps in development mode
pnpm dev

# Start specific app
pnpm --filter=api dev
pnpm --filter=web-spa dev
pnpm --filter=web-ssr dev

# Build all applications
pnpm build

# Lint and type checking
pnpm lint
pnpm lint:fix
pnpm typecheck
```

### Docker Services

```bash
pnpm docker:up      # Start PostgreSQL, MailDev, MinIO
pnpm docker:down    # Stop all services
pnpm docker:logs    # View logs
```

### Database Operations (API)

**Important**: Read [apps/documentation/src/content/docs/explanations/6_database_migrations.mdx](apps/documentation/src/content/docs/explanations/6_database_migrations.mdx) to understand the migration workflow.

```bash
# Navigate to API folder first
cd apps/api

# Development (direct entity-to-schema sync)
pnpm db:fresh        # Drop DB and recreate from entities
pnpm db:fresh:seed   # Same + run seeders

# Production (migration-based workflow)
pnpm db:migrate:create   # Generate migration from entity changes
pnpm db:migrate:up       # Apply pending migrations
pnpm db:migrate:down     # Rollback last migration
pnpm db:migrate:fresh    # Drop DB and run all migrations
pnpm db:migrate:seed     # Same + run seeders
```

**Migration workflow**: When entities change, create a migration file, review the generated SQL (edit if needed), then apply it. The `.snapshot.json` file tracks schema state and must be committed to Git.

### Type Generation

```bash
# Generate OpenAPI types/SDK for frontend (API must be running)
pnpm generate
```

The `pnpm dev` command automatically watches for API changes and regenerates types. Generated files are in [packages/openapi-generator/client/](packages/openapi-generator/client/) and must be committed.

### Module Generation

```bash
# Generate new API module (controller, service, entity, contract, tests)
pnpm schematics:module
```

### Testing

```bash
pnpm test           # Run all tests
cd apps/api && pnpm test:watch  # Watch mode for API tests
```

## Architecture Overview

### Monorepo Structure

```
lonestone/
├── apps/
│   ├── api/              # NestJS backend
│   ├── web-spa/          # React SPA (client-side routing)
│   ├── web-ssr/          # React SSR (server-side rendering)
│   └── documentation/    # Starlight docs site
├── packages/
│   ├── ui/               # Shared shadcn/ui components
│   ├── openapi-generator/# OpenAPI → TypeScript generator
│   └── schematics/       # Code generators for API modules
```

### Backend (NestJS) Architecture

**Module Structure** (see [apps/documentation/src/content/docs/guidelines/backend.mdx](apps/documentation/src/content/docs/guidelines/backend.mdx)):

```
modules/feature-name/
├── feature-name.module.ts
├── feature-name.controller.ts  # HTTP endpoints with TypedRoute decorators
├── feature-name.service.ts     # Business logic
├── feature-name.entity.ts      # MikroORM entity (or entities/ subfolder)
└── contracts/
    └── feature-name.contract.ts # Zod schemas for validation
```

**Key patterns**:

- Use `@TypedRoute.*`, `@TypedBody`, `@TypedParam` decorators from `@lonestone/nzoth/server`
- All validation schemas use Zod with `.meta()` for OpenAPI documentation
- Entities use MikroORM decorators, UUIDs as primary keys, and audit fields (createdAt, updatedAt)
- Authentication via Better Auth with guards for protected routes

**Example contract pattern**:

```typescript
// Start with base schema
const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
}).meta({ title: 'User', description: '...' })

// Extend for create/update
const createUserSchema = userSchema.meta({ title: 'Create User' })
const updateUserSchema = userSchema.partial().meta({ title: 'Update User' })
```

### Frontend Architecture

**Structure** (see [apps/documentation/src/content/docs/guidelines/frontend.mdx](apps/documentation/src/content/docs/guidelines/frontend.mdx)):

```
src/
├── app/                    # Global components, layouts
├── features/
│   ├── common/             # Shared hooks, utils, atoms
│   │   ├── hooks/
│   │   ├── utils/
│   │   └── atoms/
│   └── feature-name/       # Feature-specific code
│       ├── components/     # Feature UI components
│       ├── hooks/          # Feature hooks
│       └── utils/          # Includes *-queries.ts for TanStack Query
└── utils/                  # Global utilities
```

**Key patterns**:

- Use components from `@lonestone/ui` package (shadcn/ui)
- Import types/schemas/SDK from `@lonestone/openapi-generator`
- TanStack Query options organized in `features/*/utils/*-queries.ts` files
- React Router v7 for routing (routes defined in `routes.ts`)
- React Hook Form + Zod for form validation

**Example query pattern**:

```typescript
// features/posts/utils/posts-queries.ts
export function fetchPostsQueryOptions(options: { page: number }) {
  return {
    queryKey: ['posts', options.page],
    queryFn: () => apiClient.postsControllerFindAll({ query: { page: options.page } }),
  }
}

// In component
const { data } = useQuery(fetchPostsQueryOptions({ page: 1 }))
```

### Full-Stack Type Flow

1. Define Zod schemas in API contract files with `.meta()` for OpenAPI
2. Use `@TypedRoute.*` decorators to register endpoints
3. API automatically generates OpenAPI spec at `/api/docs`
4. Run `pnpm generate` to create TypeScript types/SDK in `packages/openapi-generator/client/`
5. Frontend imports types and SDK from `@lonestone/openapi-generator`

## Naming Conventions

- **Files**: kebab-case (`user-profile.tsx`, `user.service.ts`)
- **Directories**: kebab-case (`feature-name/`, `components/`)
- **Classes/Interfaces/Types**: PascalCase (`UserService`, `IUserProfile`)
- **Variables/Functions/Methods**: camelCase (`getUserProfile`, `isLoading`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_USERS`)
- **Booleans**: Prefix with `is`, `has`, `can` (`isLoading`, `hasError`)
- **Event handlers**: Prefix with `handle` (`handleClick`, `handleSubmit`)
- **Custom hooks**: Prefix with `use` (`useAuth`, `useForm`)

## Important Practices

### TypeScript

- Never use `any` - create proper types
- Use interfaces over types
- Export inferred types from Zod schemas: `type User = z.infer<typeof userSchema>`

### API Development

- Always use `@TypedRoute.*` decorators for type-safe endpoints
- Add `.meta()` to all Zod schemas for OpenAPI documentation
- Review generated migration SQL before applying (MikroORM may generate DROP+ADD instead of RENAME)
- Commit `.snapshot.json` with migration files

### Frontend Development

- Use `@lonestone/ui` components (not native HTML elements)
- Use Lucide icons only (no inline SVG)
- Structure TanStack Query options in `features/*/utils/*-queries.ts`
- Never hardcode user-facing strings - use i18n `t()` function

### General

- Follow SOLID principles and functional programming patterns
- Keep functions small with single purpose
- Use higher-order functions (map, filter) over loops
- Early returns to avoid nesting
- Extract complex logic into custom hooks (frontend) or utility functions (backend)

## Related Documentation

Key files to reference:

- [Backend Guidelines](apps/documentation/src/content/docs/guidelines/backend.mdx)
- [Frontend Guidelines](apps/documentation/src/content/docs/guidelines/frontend.mdx)
- [Architecture Overview](apps/documentation/src/content/docs/explanations/1_architecture.mdx)
- [Database Migrations](apps/documentation/src/content/docs/explanations/6_database_migrations.mdx)
- [API README](apps/api/README.md)

Access full documentation: `pnpm docs-only` (starts documentation site)
