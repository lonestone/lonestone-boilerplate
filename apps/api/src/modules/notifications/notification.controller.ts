import { TypedBody, TypedController, TypedRoute } from '@lonestone/nzoth/server'
import { UseGuards } from '@nestjs/common'
import { LoggedInBetterAuthSession } from '../auth/auth.config'
import { Session } from '../auth/auth.decorator'
import { AuthGuard } from '../auth/auth.guard'
import {
  notificationPreferenceSchema,
  RegisterDeviceInput,
  registerDeviceSchema,
  UpdateNotificationPreferenceInput,
  updateNotificationPreferenceSchema,
} from './contracts/notification.contract'
import { NotificationService } from './notification.service'

@TypedController('notifications', undefined, { tags: ['Notifications'] })
@UseGuards(AuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @TypedRoute.Get('preferences', notificationPreferenceSchema)
  async getPreferences(@Session() session: LoggedInBetterAuthSession) {
    const prefs = await this.notificationService.getOrCreatePreferences(session.user.id)
    return {
      id: prefs.id,
      emailEnabled: prefs.emailEnabled,
      pushEnabled: prefs.pushEnabled,
      notifyNewMatch: prefs.notifyNewMatch,
      notifyRsvpReminder: prefs.notifyRsvpReminder,
      notifyMatchCancelled: prefs.notifyMatchCancelled,
      chatMentionsOnly: prefs.chatMentionsOnly,
      notifyChatMention: prefs.notifyChatMention,
      notifyAllChatMessages: prefs.notifyAllChatMessages,
    }
  }

  @TypedRoute.Put('preferences', notificationPreferenceSchema)
  async updatePreferences(
    @Session() session: LoggedInBetterAuthSession,
    @TypedBody(updateNotificationPreferenceSchema) body: UpdateNotificationPreferenceInput,
  ) {
    const prefs = await this.notificationService.updatePreferences(session.user.id, body)
    return {
      id: prefs.id,
      emailEnabled: prefs.emailEnabled,
      pushEnabled: prefs.pushEnabled,
      notifyNewMatch: prefs.notifyNewMatch,
      notifyRsvpReminder: prefs.notifyRsvpReminder,
      notifyMatchCancelled: prefs.notifyMatchCancelled,
      chatMentionsOnly: prefs.chatMentionsOnly,
      notifyChatMention: prefs.notifyChatMention,
      notifyAllChatMessages: prefs.notifyAllChatMessages,
    }
  }

  @TypedRoute.Post('devices')
  async registerDevice(
    @Session() session: LoggedInBetterAuthSession,
    @TypedBody(registerDeviceSchema) body: RegisterDeviceInput,
  ) {
    const device = await this.notificationService.registerDevice(
      session.user.id,
      body.token,
      body.platform,
    )
    return { id: device.id, platform: device.platform }
  }
}
