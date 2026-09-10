import { EntityManager } from '@mikro-orm/core'
import { CreateRequestContext } from '@mikro-orm/decorators/legacy'
import { Injectable, Logger } from '@nestjs/common'
import { Member, User } from '../auth/auth.entity'
import { EmailService } from '../email/email.service'
import { AttendanceStatus } from '../matches/contracts/match.contract'
import { MatchAttendance } from '../matches/match-attendance.entity'
import { Match } from '../matches/match.entity'
import {
  DevicePlatform,
  ScheduledJobStatus,
  ScheduledJobType,
} from './contracts/notification.contract'
import { DeviceToken } from './device-token.entity'
import { NotificationPreference } from './notification-preference.entity'
import { ScheduledJob } from './scheduled-job.entity'

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name)

  constructor(
    private readonly em: EntityManager,
    private readonly emailService: EmailService,
  ) {}

  async getOrCreatePreferences(userId: string): Promise<NotificationPreference> {
    let prefs = await this.em.findOne(NotificationPreference, { user: { id: userId } })
    if (!prefs) {
      const user = await this.em.findOne(User, { id: userId })
      if (!user) throw new Error('User not found')
      prefs = new NotificationPreference()
      prefs.user = user
      this.em.persist(prefs)
      await this.em.flush()
    }
    return prefs
  }

  async updatePreferences(
    userId: string,
    data: Partial<NotificationPreference>,
  ): Promise<NotificationPreference> {
    const prefs = await this.getOrCreatePreferences(userId)
    Object.assign(prefs, {
      emailEnabled: data.emailEnabled ?? prefs.emailEnabled,
      pushEnabled: data.pushEnabled ?? prefs.pushEnabled,
      notifyNewMatch: data.notifyNewMatch ?? prefs.notifyNewMatch,
      notifyRsvpReminder: data.notifyRsvpReminder ?? prefs.notifyRsvpReminder,
      notifyMatchCancelled: data.notifyMatchCancelled ?? prefs.notifyMatchCancelled,
      chatMentionsOnly: data.chatMentionsOnly ?? prefs.chatMentionsOnly,
      notifyChatMention: data.notifyChatMention ?? prefs.notifyChatMention,
      notifyAllChatMessages: data.notifyAllChatMessages ?? prefs.notifyAllChatMessages,
    })
    await this.em.flush()
    return prefs
  }

  async registerDevice(
    userId: string,
    token: string,
    platform: DevicePlatform,
  ): Promise<DeviceToken> {
    const user = await this.em.findOne(User, { id: userId })
    if (!user) throw new Error('User not found')
    let device = await this.em.findOne(DeviceToken, { token })
    if (!device) {
      device = new DeviceToken()
      device.token = token
      this.em.persist(device)
    }
    device.user = user
    device.platform = platform
    await this.em.flush()
    return device
  }

  async scheduleMatchReminders(match: Match): Promise<void> {
    const offsets = match.reminderOffsetsHours?.length
      ? match.reminderOffsetsHours
      : [120, 48]

    // Initial invite ~5 days before if not already closer
    const inviteOffset = Math.max(...offsets, 120)
    const inviteAt = new Date(match.startsAt.getTime() - inviteOffset * 60 * 60 * 1000)
    if (inviteAt > new Date()) {
      await this.enqueue(match, ScheduledJobType.MatchInvite, inviteAt, { offsetHours: inviteOffset })
    }

    for (const hours of offsets) {
      const runAt = new Date(match.startsAt.getTime() - hours * 60 * 60 * 1000)
      if (runAt <= new Date()) continue
      await this.enqueue(match, ScheduledJobType.RsvpReminder, runAt, { offsetHours: hours })
    }
  }

  private async enqueue(
    match: Match,
    type: ScheduledJobType,
    runAt: Date,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    const job = new ScheduledJob()
    job.match = match
    job.type = type
    job.runAt = runAt
    job.payload = payload
    job.status = ScheduledJobStatus.Pending
    this.em.persist(job)
    await this.em.flush()
  }

  async cancelMatchJobs(matchId: string): Promise<void> {
    const jobs = await this.em.find(ScheduledJob, {
      match: { id: matchId },
      status: ScheduledJobStatus.Pending,
    })
    for (const job of jobs) job.status = ScheduledJobStatus.Cancelled
    await this.em.flush()
  }

  async notifyNewMatch(match: Match): Promise<void> {
    const members = await this.em.find(
      Member,
      { organization: { id: match.organization.id } },
      { populate: ['user'] },
    )
    for (const member of members) {
      const prefs = await this.getOrCreatePreferences(member.user.id)
      if (!prefs.notifyNewMatch) continue
      await this.deliver(
        member.user,
        prefs,
        `New match: ${match.title}`,
        `A new match is scheduled on ${match.startsAt.toISOString()} at ${match.location ?? 'TBD'}. Please respond present or absent.`,
      )
    }
  }

  async notifyMatchCancelled(match: Match): Promise<void> {
    const present = await this.em.find(
      MatchAttendance,
      { match: { id: match.id }, status: AttendanceStatus.Present },
      { populate: ['user'] },
    )
    for (const row of present) {
      const prefs = await this.getOrCreatePreferences(row.user.id)
      if (!prefs.notifyMatchCancelled) continue
      await this.deliver(
        row.user,
        prefs,
        `Match cancelled: ${match.title}`,
        match.cancellationReason ?? 'The match has been cancelled.',
      )
    }
  }

  async notifyChatMessage(
    match: Match,
    author: User,
    body: string,
    mentionedUserIds: string[],
  ): Promise<void> {
    const members = await this.em.find(
      Member,
      { organization: { id: match.organization.id } },
      { populate: ['user'] },
    )
    for (const member of members) {
      if (member.user.id === author.id) continue
      const prefs = await this.getOrCreatePreferences(member.user.id)
      const isMentioned = mentionedUserIds.includes(member.user.id)
      if (isMentioned && prefs.notifyChatMention) {
        await this.deliver(member.user, prefs, `Mentioned in ${match.title}`, body)
        continue
      }
      if (!prefs.chatMentionsOnly && prefs.notifyAllChatMessages) {
        await this.deliver(member.user, prefs, `New message in ${match.title}`, body)
      }
    }
  }

  @CreateRequestContext()
  async processDueJobs(): Promise<number> {
    const now = new Date()
    const jobs = await this.em.find(
      ScheduledJob,
      { status: ScheduledJobStatus.Pending, runAt: { $lte: now } },
      { populate: ['match', 'match.organization'], limit: 50 },
    )
    for (const job of jobs) {
      try {
        if (job.type === ScheduledJobType.MatchInvite) {
          await this.notifyNewMatch(job.match)
        } else if (job.type === ScheduledJobType.RsvpReminder) {
          await this.sendRsvpReminders(job.match)
        }
        job.status = ScheduledJobStatus.Done
      } catch (err) {
        this.logger.error(`Job ${job.id} failed`, err)
        job.status = ScheduledJobStatus.Failed
      }
    }
    await this.em.flush()
    return jobs.length
  }

  private async sendRsvpReminders(match: Match): Promise<void> {
    const pending = await this.em.find(
      MatchAttendance,
      { match: { id: match.id }, status: AttendanceStatus.Pending },
      { populate: ['user'] },
    )
    for (const row of pending) {
      const prefs = await this.getOrCreatePreferences(row.user.id)
      if (!prefs.notifyRsvpReminder) continue
      await this.deliver(
        row.user,
        prefs,
        `RSVP reminder: ${match.title}`,
        `Please confirm if you will attend the match on ${match.startsAt.toISOString()}.`,
      )
    }
  }

  private async deliver(
    user: User,
    prefs: NotificationPreference,
    subject: string,
    content: string,
  ): Promise<void> {
    if (prefs.emailEnabled) {
      await this.emailService.sendEmail({
        to: user.email,
        subject: `[Rösti] ${subject}`,
        content,
      })
    }
    if (prefs.pushEnabled) {
      const devices = await this.em.find(DeviceToken, { user: { id: user.id } })
      for (const device of devices) {
        this.logger.log(`Push to ${device.platform} token ${device.token.slice(0, 8)}…: ${subject}`)
      }
    }
  }
}
