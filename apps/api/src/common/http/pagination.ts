import { z } from 'zod'

export const paginationMetaSchema = z.object({
  offset: z.number(),
  pageSize: z.number(),
  itemCount: z.number(),
  hasMore: z.boolean(),
})

export function paginatedSchema<T extends z.ZodType>(schema: T) {
  return z.object({
    data: z.array(schema),
    meta: paginationMetaSchema,
  })
}

const DEFAULT_OFFSET = 0
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100
export const MIN_PAGE_SIZE = 1

export function createPaginationQuerySchema(options?: {
  defaultPageSize?: number
  maxPageSize?: number
  minPageSize?: number
}) {
  const defaultPageSize = options?.defaultPageSize ?? DEFAULT_PAGE_SIZE
  const maxPageSize = options?.maxPageSize ?? MAX_PAGE_SIZE
  const minPageSize = options?.minPageSize ?? MIN_PAGE_SIZE

  return z.preprocess(
    (val) => (val == null ? {} : val),
    z
      .object({
        offset: z.coerce
          .number()
          .int()
          .min(0)
          .default(DEFAULT_OFFSET)
          .describe('Starting position of the query'),
        pageSize: z.coerce
          .number()
          .int()
          .min(minPageSize)
          .max(maxPageSize)
          .default(defaultPageSize)
          .describe('Number of items to return'),
      })
      .meta({
        title: 'PaginationQuerySchema',
        description: 'Schema for pagination query',
      }),
  )
}
