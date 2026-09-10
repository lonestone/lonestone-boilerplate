import { z } from 'zod'

export const matchMessageSchema = z
  .object({
    id: z.string().uuid(),
    matchId: z.string().uuid(),
    authorId: z.string().uuid(),
    authorName: z.string(),
    body: z.string(),
    mentionedUserIds: z.array(z.string().uuid()),
    createdAt: z.coerce.date(),
  })
  .meta({ title: 'MatchMessageSchema' })

export type MatchMessageDto = z.infer<typeof matchMessageSchema>
export const matchMessagesSchema = z.array(matchMessageSchema)

export const createMatchMessageSchema = z
  .object({
    body: z.string().min(1).max(4000),
    mentionedUserIds: z.array(z.string().uuid()).optional(),
  })
  .meta({ title: 'CreateMatchMessageSchema' })

export type CreateMatchMessageInput = z.infer<typeof createMatchMessageSchema>
