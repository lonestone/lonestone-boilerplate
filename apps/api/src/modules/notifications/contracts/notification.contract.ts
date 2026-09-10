import { z } from 'zod'

export enum DevicePlatform {
  Ios = 'ios',
  Android = 'android',
  Web = 'web',
}

export enum ScheduledJobType {
  MatchInvite = 'match_invite',
  RsvpReminder = 'rsvp_reminder',
}

export enum ScheduledJobStatus {
  Pending = 'pending',
  Done = 'done',
  Cancelled = 'cancelled',
  Failed = 'failed',
}

export const notificationPreferenceSchema = z
  .object({
    id: z.string().uuid(),
    emailEnabled: z.boolean(),
    pushEnabled: z.boolean(),
    notifyNewMatch: z.boolean(),
    notifyRsvpReminder: z.boolean(),
    notifyMatchCancelled: z.boolean(),
    chatMentionsOnly: z.boolean(),
    notifyChatMention: z.boolean(),
    notifyAllChatMessages: z.boolean(),
  })
  .meta({ title: 'NotificationPreferenceSchema' })

export type NotificationPreferenceDto = z.infer<typeof notificationPreferenceSchema>

export const updateNotificationPreferenceSchema = notificationPreferenceSchema
  .omit({ id: true })
  .partial()
  .meta({ title: 'UpdateNotificationPreferenceSchema' })

export type UpdateNotificationPreferenceInput = z.infer<typeof updateNotificationPreferenceSchema>

export const registerDeviceSchema = z
  .object({
    token: z.string().min(1),
    platform: z.nativeEnum(DevicePlatform),
  })
  .meta({ title: 'RegisterDeviceSchema' })

export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>
