import { z } from 'zod'

export enum MatchStatus {
  Scheduled = 'scheduled',
  Cancelled = 'cancelled',
  Played = 'played',
}

export enum RecurrenceFrequency {
  Weekly = 'weekly',
  Monthly = 'monthly',
  MonthlyNthWeekday = 'monthly_nth_weekday',
  Custom = 'custom',
}

export enum AttendanceStatus {
  Present = 'present',
  Absent = 'absent',
  Pending = 'pending',
}

export enum TeamSide {
  Blue = 'blue',
  Red = 'red',
}

export const matchSchema = z
  .object({
    id: z.string().uuid(),
    organizationId: z.string().uuid(),
    seasonId: z.string().uuid(),
    seriesId: z.string().uuid().nullish(),
    title: z.string(),
    startsAt: z.coerce.date(),
    location: z.string().nullish(),
    maxCapacity: z.number().int().positive(),
    status: z.nativeEnum(MatchStatus),
    reminderOffsetsHours: z.array(z.number().int().positive()).nullish(),
    presentCount: z.number().int().optional(),
    cancellationReason: z.string().nullish(),
    createdAt: z.coerce.date(),
  })
  .meta({ title: 'MatchSchema' })

export type MatchDto = z.infer<typeof matchSchema>
export const matchesSchema = z.array(matchSchema)

export const createMatchSchema = z
  .object({
    seasonId: z.string().uuid(),
    title: z.string().min(1),
    startsAt: z.coerce.date(),
    location: z.string().optional(),
    maxCapacity: z.number().int().positive(),
    reminderOffsetsHours: z.array(z.number().int().positive()).optional(),
    recurrence: z
      .object({
        frequency: z.nativeEnum(RecurrenceFrequency),
        rrule: z.string().optional(),
        endsAt: z.coerce.date().optional(),
        occurrenceCount: z.number().int().positive().max(52).optional(),
      })
      .optional(),
  })
  .meta({ title: 'CreateMatchSchema' })

export type CreateMatchInput = z.infer<typeof createMatchSchema>

export const updateMatchSchema = z
  .object({
    title: z.string().min(1).optional(),
    startsAt: z.coerce.date().optional(),
    location: z.string().nullish(),
    maxCapacity: z.number().int().positive().optional(),
    reminderOffsetsHours: z.array(z.number().int().positive()).nullish(),
  })
  .meta({ title: 'UpdateMatchSchema' })

export type UpdateMatchInput = z.infer<typeof updateMatchSchema>

export const cancelMatchSchema = z
  .object({
    reason: z.string().optional(),
  })
  .meta({ title: 'CancelMatchSchema' })

export type CancelMatchInput = z.infer<typeof cancelMatchSchema>

export const attendanceSchema = z
  .object({
    id: z.string().uuid(),
    matchId: z.string().uuid(),
    userId: z.string().uuid(),
    userName: z.string(),
    status: z.nativeEnum(AttendanceStatus),
    respondedAt: z.coerce.date().nullish(),
  })
  .meta({ title: 'AttendanceSchema' })

export type AttendanceDto = z.infer<typeof attendanceSchema>
export const attendancesSchema = z.array(attendanceSchema)

export const respondAttendanceSchema = z
  .object({
    status: z.enum([AttendanceStatus.Present, AttendanceStatus.Absent]),
  })
  .meta({ title: 'RespondAttendanceSchema' })

export type RespondAttendanceInput = z.infer<typeof respondAttendanceSchema>

export const setAttendanceSchema = z
  .object({
    status: z.nativeEnum(AttendanceStatus),
  })
  .meta({ title: 'SetAttendanceSchema' })

export type SetAttendanceInput = z.infer<typeof setAttendanceSchema>

export const lineupSchema = z
  .object({
    id: z.string().uuid(),
    matchId: z.string().uuid(),
    userId: z.string().uuid(),
    userName: z.string(),
    team: z.nativeEnum(TeamSide),
  })
  .meta({ title: 'LineupSchema' })

export type LineupDto = z.infer<typeof lineupSchema>
export const lineupsSchema = z.array(lineupSchema)

export const setLineupSchema = z
  .object({
    assignments: z.array(
      z.object({
        userId: z.string().uuid(),
        team: z.nativeEnum(TeamSide),
      }),
    ),
  })
  .meta({ title: 'SetLineupSchema' })

export type SetLineupInput = z.infer<typeof setLineupSchema>

export const setPlayerTeamSchema = z
  .object({
    team: z.nativeEnum(TeamSide).nullable(),
  })
  .meta({ title: 'SetPlayerTeamSchema' })

export type SetPlayerTeamInput = z.infer<typeof setPlayerTeamSchema>
