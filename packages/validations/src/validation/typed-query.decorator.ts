import type { ExecutionContext } from '@nestjs/common'
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import type { ZodSchema } from 'zod'
import { generateSchema } from '@anatine/zod-openapi'
import { BadRequestException, createParamDecorator } from '@nestjs/common'
import { ApiQuery } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationException } from './validation.exception'

type QueryValue = string | string[] | undefined

/**
 * Helper function to parse query parameters
 */
function parseQueryValue(value: QueryValue, isArray: boolean): string | string[] | undefined {
  if (value === undefined) {
    return undefined
  }

  if (isArray) {
    return Array.isArray(value) ? value : [value]
  }

  return Array.isArray(value) ? value[0] : value
}

/**
 * Creates a Zod schema for query parameters
 * @param schema - Base schema to transform
 * @param options - Configuration options
 * @param options.array - Whether to wrap schema in array
 * @param options.optional - Whether to make schema optional
 */
function createQuerySchema<T extends z.ZodType>(
  schema: T,
  options: { array?: boolean, optional?: boolean } = {},
): T | z.ZodArray<T> | z.ZodOptional<T | z.ZodArray<T>> {
  let querySchema: T | z.ZodArray<T> = schema

  if (options.array) {
    querySchema = z.array(schema)
  }

  if (options.optional) {
    return querySchema.optional()
  }

  return querySchema
}

/**
 * Type-safe query parameter decorator
 *
 * @param key - Query parameter key
 * @param schema - Zod schema for validation
 * @param options - Configuration options
 * @param options.array - Whether to wrap schema in array
 * @param options.optional - Whether to make schema optional *
 * @example
 * ```typescript
 * @Get()
 * async search(
 *   @TypedQuery('q', z.string().min(2)) query: string,
 *   @TypedQuery('tags', z.string(), { array: true }) tags: string[],
 *   @TypedQuery('page', z.coerce.number().int().positive(), { optional: true }) page?: number,
 * ) {
 *   return this.service.search(query, tags, page)
 * }
 * ```
 */
export function TypedQuery(
  key: string,
  schema: ZodSchema,
  options: { array?: boolean, optional?: boolean } = {},
) {
  const querySchema = createQuerySchema(schema, options)
  const openApiSchema = generateSchema(querySchema) as SchemaObject

  // Create our base ApiQuery decorator first
  const baseDecorator = ApiQuery({
    name: key,
    required: !options.optional,
    isArray: options.array,
    schema: openApiSchema,
    description: openApiSchema.description,
    example: openApiSchema.example,
  })

  // Create parameter decorator for validation
  const paramDecorator = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const value = parseQueryValue(request.query[key], !!options.array)

    if (value === undefined && !options.optional) {
      throw new BadRequestException(`Missing required query parameter: ${key}`)
    }

    try {
      return querySchema.parse(value)
    }
    catch (err) {
      if (err instanceof z.ZodError) {
        throw new ZodValidationException(err)
      }
      throw err
    }
  })

  // Return a decorator that applies our base ApiQuery first (so manual decorators take precedence)
  return (target: object, propertyKey: string | symbol, parameterIndex: number) => {
    baseDecorator(target.constructor, propertyKey, {
      value: target.constructor.prototype[propertyKey],
      writable: true,
      enumerable: true,
      configurable: true,
    })
    return paramDecorator()(target, propertyKey, parameterIndex)
  }
}

/**
 * Creates a validator for an entire query object
 *
 * @param schema - Zod schema for the entire query object
 *
 * @example
 * ```typescript
 * const SearchQuery = z.object({
 *   q: z.string().min(2),
 *   tags: z.array(z.string()).optional(),
 *   page: z.coerce.number().int().positive().optional(),
 * })
 *
 * @Get()
 * async search(@TypedQueryObject(SearchQuery) query: z.infer<typeof SearchQuery>) {
 *   return this.service.search(query)
 * }
 * ```
 */
export function TypedQueryObject(schema: ZodSchema) {
  const openApiSchema = generateSchema(schema) as SchemaObject
  const properties = openApiSchema.properties || {}
  const required = openApiSchema.required || []

  // Create base ApiQuery decorators first for each property
  const baseDecorators = Object.entries(properties).map(([name, prop]) =>
    ApiQuery({
      name,
      required: required.includes(name),
      schema: prop as SchemaObject,
    }),
  )

  // Create parameter decorator for validation
  const paramDecorator = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const query = request.query

    try {
      return schema.parse(query)
    }
    catch (err) {
      if (err instanceof z.ZodError) {
        throw new ZodValidationException(err)
      }
      throw err
    }
  })

  // Return a decorator that applies our base ApiQuery decorators first (so manual decorators take precedence)
  return (target: object, propertyKey: string | symbol, parameterIndex: number) => {
    const descriptor = {
      value: target.constructor.prototype[propertyKey],
      writable: true,
      enumerable: true,
      configurable: true,
    }

    // Apply all ApiQuery decorators first
    baseDecorators.forEach(decorator =>
      decorator(target.constructor, propertyKey, descriptor),
    )

    return paramDecorator()(target, propertyKey, parameterIndex)
  }
}
