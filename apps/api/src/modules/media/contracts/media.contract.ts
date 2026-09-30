import { z } from 'zod'

export const mediaSchema = z
  .object({
    id: z.uuid(),
    filename: z.string(),
    mimeType: z.string(),
    size: z.number().int().nonnegative(),
  })
  .meta({
    title: 'MediaSchema',
    description: 'A stored file. The storage key is never exposed.',
  })

export type MediaResponse = z.infer<typeof mediaSchema>
