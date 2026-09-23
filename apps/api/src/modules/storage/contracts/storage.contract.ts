import { z } from 'zod'

export const storedObjectSchema = z
  .object({
    key: z.uuid(),
    filename: z.string(),
    mimeType: z.string(),
    size: z.number().int().nonnegative(),
  })
  .meta({
    title: 'Stored Object',
    description: 'Provider-neutral metadata for an uploaded object',
  })

export const storageKeySchema = z.uuid().meta({
  description: 'Opaque storage object key',
})

export const storageMultipartSchema = z.object({}).meta({
  title: 'Storage Upload',
  description: 'Multipart upload fields validated separately from the binary file',
})

export type StoredObject = z.infer<typeof storedObjectSchema>
