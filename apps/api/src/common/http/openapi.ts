import type { StandardSchemaConverter } from '@nestjs/swagger'
import type { z } from 'zod'
import { createSchema } from 'zod-openapi'

export const standardSchemaConverter: StandardSchemaConverter = (schema, { schemaType }) => {
  const result = createSchema(schema as z.ZodType, {
    io: schemaType,
    openapiVersion: '3.1.0',
  })

  return {
    schema: result.schema,
    components: result.components,
  }
}
