# @sunagenda/nest-rest-helpers

A collection of NestJS utilities for building RESTful APIs with support for filtering, pagination, sorting, and type-safe request/response validation.

# Why this package ?

Our goal is to have a type-safe API which is easy to use while still being usable by other languages. tRPC is a great tool, but using it with other tools (low-code, AI) or other languages is not straightforward.

GraphQL is also awesome, but for most project it's overkill.

We aimed to keep things simple, with the following goals:

- Things should be as type-safe as possible;
- It should allow developers to follow the code as much as possible (ctrl+click on a DTO should bring them to the implementation);
- It should be easy to use in a monorepo environment;
- It should provide a standard way to paginate, filter and sort data;
- It should allow for data validation, input and output;
- It should help to get a CRUD API up and running quickly;
- It should be able to generate OpenAPI documentation from your Zod schemas, without modifying NestJS Swagger behavior;
- In general, it should be as unobtrusive as possible.

We use a lot of NestJS, and we copy/pasted a similar structure from project to project, but we never took the time to really make it a package.

# Features

- ✅ **Validation**: Comprehensive Zod-based validation for requests and responses
- 🎯 **Decorators**: Decorators to validate route response, parameters, query params, and body
- 🔍 **Filtering**: Flexible query parameter-based filtering with multiple operators
- 📄 **Pagination**: Easy-to-use pagination with offset and page size
- 🔃 **Sorting**: Multi-field sorting with ascending/descending support
- 📄 **OpenAPI**: Automatically generate OpenAPI documentation from your Zod schemas, without modifying NestJS Swagger behavior

# Installation

```bash
pnpm add @sunagenda/nest-rest-helpers
```

# Type safety and validation

## Validate response data

Use `TypedRoute` decorators to validate response data:

```typescript
@Controller('users')
class UserController {
  @TypedRoute.Get(undefined, UserSchema)
  findAll(): User[] {
    // Response will be validated against UserSchema
    return this.userService.findAll()
  }

  @TypedRoute.Post('/', UserSchema)
  create(@TypedBody(CreateUserSchema) dto: CreateUserDto): User {
    // Both request and response are validated
    return this.userService.create(dto)
  }
}
```

## Request Validation

## Body Validation

Two decorators are available for body validation:

### JSON Body (`@TypedBody`)

```typescript
const CreateUserSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  role: z.enum(['admin', 'user']),
})

@Controller('users')
class UserController {
  @Post()
  create(@TypedBody(CreateUserSchema) user: z.infer<typeof CreateUserSchema>) {
    // user is validated against CreateUserSchema
    // Content-Type must be application/json
    return this.userService.create(user)
  }
}
```

### Form URL-Encoded Body (`@TypedFormBody`)

```typescript
const CreateArticleSchema = z.object({
  title: z.string().min(3),
  content: z.string(),
  tags: z.array(z.string()),
})

@Controller('articles')
class ArticleController {
  @Post()
  create(@TypedFormBody(CreateArticleSchema) data: z.infer<typeof CreateArticleSchema>) {
    // data is validated against CreateArticleSchema
    // Content-Type must be application/x-www-form-urlencoded
    return this.articleService.create(data)
  }
}
```

## Query Parameters

```typescript
// Example query url: /users?q=test&tags=tag1&tags=tag2&page=1
@Controller('users')
class UserController {
  @Get()
  search(
  @TypedQuery('q', z.string().min(2)) query: string,
  @TypedQuery('tags', z.string(), { array: true }) tags: string[],
  @TypedQuery('page', z.coerce.number().int().positive(), { optional: true }) page?: number,
  ) {
    return this.userService.search(query, tags, page)
  }
}
```

For typed query objects, you can use the `TypedQueryObject` decorator:

```typescript
// Example query url: /users?q=test&tags=tag1&tags=tag2&page=1
@Controller('users')
class UserController {
  @Get()
  search(@TypedQueryObject(SearchQuery) query: z.infer<typeof SearchQuery>) {
    // Query will be an object with the following shape: { q: string, tags: string[], page: number }
    return this.userService.search(query)
  }
}
```

## Route Parameters

```typescript
// Example route url: /users/123
@Controller('users')
class UserController {
  @Get(':id')
  findOne(@TypedParam('id', 'uuid') id: string) {
    // id is validated as UUID
    return this.userService.findOne(id)
  }
}
```

# CRUD helpers

## Filtering

Use the `@FilteringParams` decorator for query-based filtering:

```typescript
// Example query url: /users?filter=name:eq:john;age:gt:18
@Controller('users')
class UserController {
  @Get()
  findAll(@FilteringParams(['name', 'age']) filters?: Filtering[]) {
    // filters will be an array of { property, rule, value }
    return this.userService.findAll(filters)
  }
}
```

Supported filter rules:
- `eq` - Equals
- `neq` - Not equals
- `gt` - Greater than
- `gte` - Greater than or equals
- `lt` - Less than
- `lte` - Less than or equals
- `like` - Like (string pattern matching)
- `nlike` - Not like
- `in` - In array
- `nin` - Not in array
- `isnull` - Is null
- `isnotnull` - Is not null

Query parameter format: `?filter=property:rule:value`

See the [Filtering](https://github.com/lonestone/nest-rest-helpers/blob/main/src/filtering/filtering.ts) file for more details.

## Pagination

Use the `@PaginationParams` decorator to handle pagination:

```typescript
// Example query url: /users?offset=0&pageSize=10
@Controller('users')
class UserController {
  @Get()
  findAll(@PaginationParams() pagination: Pagination) {
    // pagination will contain { offset, pageSize }
    return this.userService.findAll(pagination)
  }
}
```

Query parameter format: `?offset=0&pageSize=10`

The response will be wrapped in a paginated format:

```typescript
interface PaginatedResponse<T> {
  data: T[]
  meta: {
    offset: number
    pageSize: number
    itemCount: number
    hasMore: boolean
  }
}
```

See the [Pagination](https://github.com/lonestone/nest-rest-helpers/blob/main/src/pagination/pagination.ts) file for more details.

## Sorting

Use the `@SortingParams` decorator for query-based sorting:

```typescript
// Example query url: /users?sort=name:asc,age:desc
@Controller('users')
class UserController {
  @Get()
  findAll(@SortingParams(['name', 'age']) sort?: Sort[]) {
    // sort will be an array of { property, direction }
    return this.userService.findAll(sort)
  }
}
```

Query parameter format: `?sort=property:direction`

See the [Sorting](https://github.com/lonestone/nest-rest-helpers/blob/main/src/sorting/sorting.ts) file for more details.

## Error Handling

The package includes built-in exception filters for validation errors:

```typescript
// In your app.module.ts or main.ts
app.useGlobalFilters(
  new ZodValidationExceptionFilter(),
  new ZodSerializationExceptionFilter()
)
```

Error responses will include detailed validation errors:

```json
{
  "statusCode": 400,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/users",
  "errors": [
    {
      "code": "invalid_type",
      "message": "Expected string, received number",
      "path": ["name"]
    }
  ]
}
```

# OpenAPI Documentation

All decorators automatically generate OpenAPI documentation from your Zod schemas. Under the hood, they use the `@ApiResponse`, `@ApiBody`, `@ApiQuery`, `@ApiParam` decorators from NestJS Swagger and an OpenAPI schema generated by `zod-openapi`.

## Important notes

This package requires OpenAPI 3.1.0, because zod-openapi is not compatible with OpenAPI 3.0.0 (it will show "Unknown type: object" errors).

So set your swagger version to 3.1.0 while booting your NestJS app:

```typescript
const config = new DocumentBuilder()
  .setOpenAPIVersion('3.1.0')
  .setTitle('Docs Swagger')
  .setVersion('1.0.0')
  .addBearerAuth()
  .build()
```

## Override Response Documentation

You can override the generated documentation using NestJS Swagger decorators:

```typescript
@Controller('users')
class UserController {
  @ApiResponse({
    status: 200,
    description: 'Custom description',
    content: {
      'application/json': {
        examples: {
          user: { value: { id: '123', name: 'John' } }
        }
      }
    }
  })
  @TypedRoute.Get(':id', UserSchema)
  findOne(@TypedParam('id', 'uuid') id: string) {
    return this.userService.findOne(id)
  }
}
```

## Override Body Documentation

```typescript
@Controller('users')
class UserController {
  @ApiBody({
    description: 'Custom description',
    examples: {
      user: {
        value: { name: 'John', email: 'john@example.com' }
      }
    }
  })
  @Post()
  create(@TypedBody(CreateUserSchema) user: z.infer<typeof CreateUserSchema>) {
    return this.userService.create(user)
  }
}
```

## Override Query Documentation

```typescript
@Controller('users')
class UserController {
  @ApiQuery({
    name: 'search',
    description: 'Custom description',
    example: 'john'
  })
  @Get()
  search(@TypedQuery('search', z.string().min(2)) query: string) {
    return this.userService.search(query)
  }
}
```

## Override Parameter Documentation

```typescript
@Controller('users')
class UserController {
  @ApiParam({
    name: 'id',
    description: 'Custom description',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @Get(':id')
  findOne(@TypedParam('id', 'uuid') id: string) {
    return this.userService.findOne(id)
  }
}
```

# License

UNLICENSED - ©Lonestone - Pierrick Bignet
