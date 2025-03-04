---
Description: This document contains guidelines for the API of the Lonestone project.
Globs: apps/api/*
---

# API Guidelines

## Stack

- NestJS
- TypeScript
- MikroORM
- Zod
- Swagger/OpenAPI
- Better Auth

## Architecture

### Module Structure

Each feature should be organized as a NestJS module with the following structure:

```
modules/feature-name/
├── feature-name.module.ts     # Module definition
├── feature-name.controller.ts # HTTP endpoints
├── feature-name.service.ts    # Business logic
├── feature-name.entity.ts     # Database entities
└── contracts/                 # DTOs and validation schemas
    └── feature-name.contract.ts
```

### Naming Conventions

- **Files**: Use kebab-case for filenames (e.g., `user-profile.service.ts`)
- **Classes**: Use PascalCase for class names (e.g., `UserProfileService`)
- **Methods**: Use camelCase for method names (e.g., `getUserProfile`)
- **Variables**: Use camelCase for variable names (e.g., `userProfile`)
- **Constants**: Use UPPER_SNAKE_CASE for constants (e.g., `MAX_USERS`)
- **Interfaces/Types**: Use PascalCase prefixed with 'I' for interfaces (e.g., `IUserProfile`)
- **Enums**: Use PascalCase for enum names (e.g., `UserRole`)

## API Design

### Controllers

- Use decorators from NestJS for route definition
- Group related endpoints under the same controller
- Use versioning when making breaking changes
- Use proper HTTP methods:
  - `GET` for retrieving data
  - `POST` for creating resources
  - `PUT` for full updates
  - `PATCH` for partial updates
  - `DELETE` for removing resources

### Request Validation

- Use Zod schemas for request validation
- Define schemas in the contracts directory
- Use `TypedBody`, `TypedParam`, and other typed decorators from `@lonestone/validations/server`
- Export types from schemas using `z.infer<typeof schema>`
- Extend zod schema with `extendApi()` from `@lonestone/validations/server`

Example:
```typescript
export const createUserSchema = extendApi(z.object({
  name: z.string().min(2),
  email: z.string().email(),
}), {
    title: "Create User",
    description: "Create a new user",
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

@TypedRoute.Post("", userSchema)
async createUser(@TypedBody(createUserSchema) body: CreateUserInput) {
  // Implementation
}
```

### Response Formatting

- Use consistent response formats
- Return typed responses using Zod schemas
- Document responses with OpenAPI annotations

### Error Handling

- Use NestJS exceptions for error handling
- Return appropriate HTTP status codes
- Provide meaningful error messages
- Use exception filters for global error handling

## Database

### Entities

- Use MikroORM decorators for entity definition
- Follow single responsibility principle
- Use UUIDs for primary keys
- Include audit fields (createdAt, updatedAt)
- Define proper indexes for performance
- Use appropriate relationships (OneToMany, ManyToOne, etc.)

Example:
```typescript
@Entity({ tableName: "user" })
export class User {
  @PrimaryKey({ type: "uuid", defaultRaw: "gen_random_uuid()" })
  id!: string;

  @Property()
  @Index()
  name!: string;

  @Property({ fieldName: "createdAt" })
  createdAt: Date = new Date();

  @Property({ fieldName: "updatedAt", onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
```

### Queries

- Use the EntityManager for database operations
- Use transactions for operations that modify multiple entities
- Optimize queries for performance
- Use pagination for large result sets

## Authentication & Authorization

- Use Better Auth for authentication
- Use guards for protecting routes
- Use decorators for role-based access control
- Validate user permissions in services

Example:
```typescript
@Controller("admin/users")
@UseGuards(AuthGuard)
export class UserController {
  // Protected endpoints
}
```

## Documentation

- Use Swagger/OpenAPI for API documentation
- Document all endpoints, parameters, and responses
- Use tags to group related endpoints
- Provide examples for request and response bodies

## Testing

- Write unit tests for services
- Write integration tests for controllers
- Use Jest for testing
- Mock external dependencies