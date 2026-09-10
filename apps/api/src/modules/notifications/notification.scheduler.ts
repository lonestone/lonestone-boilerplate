import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { NotificationService } from './notification.service'

@Injectable()
export class NotificationScheduler {
  private readonly logger = new Logger(NotificationScheduler.name)

  constructor(private readonly notificationService: NotificationService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleDueJobs(): Promise<void> {
    const count = await this.notificationService.processDueJobs()
    if (count > 0) {
      this.logger.log(`Processed ${count} notification jobs`)
    }
  }
}
