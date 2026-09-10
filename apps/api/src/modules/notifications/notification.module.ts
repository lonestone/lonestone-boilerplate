import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { EmailModule } from '../email/email.module'
import { DeviceToken } from './device-token.entity'
import { NotificationController } from './notification.controller'
import { NotificationPreference } from './notification-preference.entity'
import { NotificationScheduler } from './notification.scheduler'
import { NotificationService } from './notification.service'
import { ScheduledJob } from './scheduled-job.entity'

@Module({
  imports: [
    EmailModule,
    MikroOrmModule.forFeature([NotificationPreference, DeviceToken, ScheduledJob]),
  ],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationScheduler],
  exports: [NotificationService],
})
export class NotificationModule {}
