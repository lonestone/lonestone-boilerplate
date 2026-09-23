import { z } from 'zod'

export const documentSchema = z
  .object({
    id: z.uuid(),
    filename: z.string(),
    mimeType: z.string(),
    size: z.number().int().nonnegative(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .meta({
    title: 'Document',
    description: 'Metadata for a document owned by the authenticated user',
  })

export const documentIdSchema = z.uuid().meta({
  description: 'Document identifier',
})

export const documentMultipartSchema = z.object({}).meta({
  title: 'Document Upload',
  description: 'Multipart upload fields validated separately from the binary file',
})

export type DocumentResponse = z.infer<typeof documentSchema>
