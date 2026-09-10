import { z } from 'zod'

export enum SportType {
  Football = 'football',
  Futsal = 'futsal',
  Basketball = 'basketball',
  Volleyball = 'volleyball',
  Tennis = 'tennis',
  Padel = 'padel',
  Badminton = 'badminton',
  Other = 'other',
}

export const clubMemberSchema = z
  .object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
    firstName: z.string().nullish(),
    lastName: z.string().nullish(),
    phone: z.string().nullish(),
    role: z.enum(['owner', 'admin', 'member']),
    createdAt: z.coerce.date(),
  })
  .meta({ title: 'ClubMemberSchema' })

export type ClubMemberDto = z.infer<typeof clubMemberSchema>
export const clubMembersSchema = z.array(clubMemberSchema)

export const updateMemberRoleSchema = z
  .object({
    role: z.enum(['admin', 'member']),
  })
  .meta({ title: 'UpdateMemberRoleSchema' })

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>

export const clubSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string().nullish(),
    logo: z.string().nullish(),
    paymentLink: z.string().nullish(),
    venue: z.string().nullish(),
    sportType: z.nativeEnum(SportType).nullish(),
    defaultMaxCapacity: z.number().int().positive().nullish(),
    createdAt: z.coerce.date(),
  })
  .meta({ title: 'ClubSchema' })

export type ClubDto = z.infer<typeof clubSchema>
export const clubsSchema = z.array(clubSchema)

export const updateClubSchema = z
  .object({
    name: z.string().min(1).optional(),
    venue: z.string().min(1).nullish(),
    sportType: z.nativeEnum(SportType).nullish(),
    defaultMaxCapacity: z.number().int().positive().nullish(),
  })
  .meta({ title: 'UpdateClubSchema' })

export type UpdateClubInput = z.infer<typeof updateClubSchema>
