import { z } from 'zod'

export const sortDirectionSchema = z.enum(['asc', 'desc'], {
  error: () => ({
    message: 'Invalid sort direction. Use either "asc" or "desc"',
  }),
})

export function SortingSchema<T extends readonly [string, ...string[]]>(enabledKeys: T) {
  return z
    .object({
      property: z.enum(enabledKeys),
      direction: sortDirectionSchema,
    })
    .meta({
      title: 'SortingSchema',
      description: 'Schema for sorting items',
    })
}

export function SortingStringSchema<T extends readonly [string, ...string[]]>(enabledKeys: T) {
  return z
    .string()
    .regex(/^[^:]+(?::(asc|desc))?$/, 'Invalid sort format. Expected format: property[:asc|desc]')
    .transform((val) => {
      const [property, direction = 'asc'] = val.split(':')
      return {
        property,
        direction: direction as z.infer<typeof sortDirectionSchema>,
      }
    })
    .pipe(SortingSchema(enabledKeys))
    .meta({
      title: 'SortingStringSchema',
      description: 'Schema for sorting items',
    })
}

export function createSortingQueryStringSchema<T extends readonly [string, ...string[]]>(
  enabledKeys: T,
) {
  return z
    .string()
    .transform((val) => val?.split(',').map((s) => s.trim()))
    .pipe(z.array(SortingStringSchema(enabledKeys)))
    .optional()
    .meta({
      title: 'SortingQueryStringSchema',
      description: 'Schema for sorting items',
      example: 'name:asc,age:desc',
    })
}
