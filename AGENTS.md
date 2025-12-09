# AGENTS.md

## Essential Commands

### Development
- `pnpm dev` - Start all apps in development mode
- `pnpm --filter=api dev` - Start API only
- `pnpm --filter=web-spa dev` - Start SPA only

### Build & Quality
- `pnpm build` - Build all applications
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Fix ESLint issues
- `pnpm typecheck` - Type check all projects

### Testing
- `pnpm test` - Run all tests
- `cd apps/api && pnpm test` - Run API tests
- `cd apps/api && pnpm test:watch` - Watch mode for API tests
- `cd apps/api && pnpm test -- path/to/test.spec.ts` - Run single test

### Type Generation
- `pnpm generate` - Generate OpenAPI types from running API

## Code Style Guidelines

### Naming Conventions
- Files/Directories: kebab-case (`user-profile.tsx`)
- Classes/Interfaces/Types: PascalCase (`UserService`)
- Variables/Functions: camelCase (`getUserProfile`)
- Constants: UPPER_SNAKE_CASE (`MAX_USERS`)
- Booleans: `is`, `has`, `can` prefixes (`isLoading`)
- Event handlers: `handle` prefix (`handleClick`)
- Custom hooks: `use` prefix (`useAuth`)

### TypeScript Rules
- Never use `any` - create proper types
- Use interfaces over types
- Export inferred types from Zod: `type User = z.infer<typeof userSchema>`

### Import Organization
1. External libraries (React, NestJS, etc.)
2. Internal packages (@lonestone/*)
3. Local imports (../features/*)

### API Development
- Use `@TypedRoute.*`, `@TypedBody`, `@TypedParam` decorators
- Add `.meta()` to all Zod schemas for OpenAPI
- Follow NestJS module structure: controller, service, entity, contracts

### Frontend Development
- Use `@lonestone/ui` components (shadcn/ui)
- Import types/SDK from `@lonestone/openapi-generator`
- Structure TanStack Query options in `features/*/utils/*-queries.ts`
- Use Lucide icons only

### Error Handling
- Use exceptions for unexpected errors
- Add context when catching exceptions
- Use global handlers for unhandled errors

### Testing
- Follow Arrange-Act-Assert convention
- Name test variables: inputX, mockX, actualX, expectedX
- Write unit tests for public functions
- Use test doubles for dependencies
