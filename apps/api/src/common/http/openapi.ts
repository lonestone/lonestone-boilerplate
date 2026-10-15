import type { OpenAPIObject, StandardSchemaConverter } from '@nestjs/swagger'
import type { z } from 'zod'
import { createSchema } from 'zod-openapi'

type JsonSchema = Record<string, unknown>

// Values under these keys are data, not schemas: an example post with a `title` is not a component.
const DATA_KEYS = new Set(['example', 'examples', 'default', 'const', 'enum'])

/**
 * Replaces every sub-schema that has a `title` with a `$ref` to a component of that name.
 * zod-openapi only names schemas that carry a `.meta({ id })`; the contracts use `.meta({ title })`,
 * and the generated client relies on those names (`CommentSchema`, `PublicPostsSchema`, ...).
 */
function extractTitledSchemas(node: unknown, components: Record<string, JsonSchema>): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => extractTitledSchemas(item, components))
  }
  if (!node || typeof node !== 'object') {
    return node
  }

  const schema = extractChildren(node as JsonSchema, components)
  if (typeof schema.title !== 'string') {
    return schema
  }
  components[schema.title] ??= schema
  return { $ref: `#/components/schemas/${schema.title}` }
}

function extractChildren(schema: JsonSchema, components: Record<string, JsonSchema>): JsonSchema {
  const result: JsonSchema = {}
  for (const [key, value] of Object.entries(schema)) {
    result[key] = DATA_KEYS.has(key) ? value : extractTitledSchemas(value, components)
  }
  return result
}

function stripTitles(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(stripTitles)
  }
  if (!node || typeof node !== 'object') {
    return node
  }
  return Object.fromEntries(
    Object.entries(node)
      .filter(([key]) => key !== 'title')
      .map(([key, value]) => [key, DATA_KEYS.has(key) ? value : stripTitles(value)]),
  )
}

export const standardSchemaConverter: StandardSchemaConverter = (schema, { schemaType }) => {
  const result = createSchema(schema as z.ZodType, {
    io: schemaType,
    openapiVersion: '3.1.0',
  })

  const components: Record<string, JsonSchema> = {}
  for (const [name, component] of Object.entries(result.components)) {
    components[name] = extractChildren(component as JsonSchema, components)
  }

  // Request bodies and query objects stay inline: Swagger expands a query object into one
  // parameter per property, which it cannot do through a `$ref`. The named component is still emitted.
  const root = result.schema as JsonSchema
  if (schemaType === 'input' && typeof root.title === 'string') {
    const inline = extractChildren(root, components)
    components[root.title] ??= inline
    return { schema: inline, components }
  }

  return {
    schema: extractTitledSchemas(root, components) as JsonSchema,
    components,
  }
}

/**
 * JSON schema of one `sort` / `filter` item, for the `items` of the query string parameter.
 * `packages/openapi-generator/preprocess` turns `{ type: 'string', format, items }` into a typed array,
 * and the client joins it back into a string. Titles are stripped so the items stay inline.
 */
export function queryItemsSchema(itemSchema: z.ZodType): JsonSchema {
  return stripTitles(
    createSchema(itemSchema, { io: 'output', openapiVersion: '3.1.0' }).schema,
  ) as JsonSchema
}

const registeredSchemas = new Set<z.ZodType>()

/** Adds a schema to the OpenAPI components even when no route uses it, so the client exports its type. */
export function registerSchema(schema: z.ZodType): void {
  registeredSchemas.add(schema)
}

export function addRegisteredSchemas(document: OpenAPIObject): void {
  const schemas = (document.components ??= {}).schemas ?? {}
  for (const schema of registeredSchemas) {
    const result = standardSchemaConverter(schema, { schemaType: 'output' })
    if (!result || !('$ref' in (result.schema as JsonSchema))) {
      throw new Error('registerSchema() needs a schema with .meta({ title })')
    }
    for (const [name, component] of Object.entries(result.components ?? {})) {
      schemas[name] ??= component as JsonSchema
    }
  }
  document.components.schemas = schemas
}
