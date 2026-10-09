import { z } from 'zod'

export const mediaSchema = z
  .object({
    id: z.uuid(),
    filename: z.string(),
    mimeType: z.string(),
    size: z.number().int().nonnegative(),
    url: z.url(),
    expiresAt: z.date(),
  })
  .meta({
    title: 'MediaSchema',
    description:
      'A stored file. `url` is a short-lived signed download link that expires at `expiresAt`. The storage key is never returned as a field.',
  })

export type MediaResponse = z.infer<typeof mediaSchema>
