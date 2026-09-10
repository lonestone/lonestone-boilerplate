import { z } from 'zod'

export enum SeasonStatus {
  Active = 'active',
  Closed = 'closed',
}

export const seasonSchema = z
  .object({
    id: z.string().uuid(),
    organizationId: z.string().uuid(),
    name: z.string(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().nullish(),
    status: z.nativeEnum(SeasonStatus),
    createdAt: z.coerce.date(),
  })
  .meta({ title: 'SeasonSchema' })

export type SeasonDto = z.infer<typeof seasonSchema>

export const createSeasonSchema = z
  .object({
    name: z.string().min(1),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().optional(),
  })
  .meta({ title: 'CreateSeasonSchema' })

export type CreateSeasonInput = z.infer<typeof createSeasonSchema>

export const updateSeasonSchema = z
  .object({
    name: z.string().min(1).optional(),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().nullish(),
    status: z.nativeEnum(SeasonStatus).optional(),
  })
  .meta({ title: 'UpdateSeasonSchema' })

export type UpdateSeasonInput = z.infer<typeof updateSeasonSchema>

export const seasonsSchema = z.array(seasonSchema)
