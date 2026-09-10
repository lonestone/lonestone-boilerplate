import { z } from 'zod'

export const matchStatSchema = z
  .object({
    id: z.string().uuid(),
    matchId: z.string().uuid(),
    userId: z.string().uuid(),
    userName: z.string(),
    goals: z.number().int().nonnegative(),
    assists: z.number().int().nonnegative(),
  })
  .meta({ title: 'MatchStatSchema' })

export type MatchStatDto = z.infer<typeof matchStatSchema>
export const matchStatsSchema = z.array(matchStatSchema)

export const upsertMatchStatsSchema = z
  .object({
    stats: z.array(
      z.object({
        userId: z.string().uuid(),
        goals: z.number().int().nonnegative(),
        assists: z.number().int().nonnegative(),
      }),
    ),
  })
  .meta({ title: 'UpsertMatchStatsSchema' })

export type UpsertMatchStatsInput = z.infer<typeof upsertMatchStatsSchema>

export const seasonPlayerStatSchema = z
  .object({
    userId: z.string().uuid(),
    userName: z.string(),
    goals: z.number().int(),
    assists: z.number().int(),
    matchesPlayed: z.number().int(),
  })
  .meta({ title: 'SeasonPlayerStatSchema' })

export type SeasonPlayerStatDto = z.infer<typeof seasonPlayerStatSchema>
export const seasonPlayerStatsSchema = z.array(seasonPlayerStatSchema)
