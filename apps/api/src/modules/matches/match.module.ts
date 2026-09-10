import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module, forwardRef } from '@nestjs/common'
import { NotificationModule } from '../notifications/notification.module'
import { MatchAttendance } from './match-attendance.entity'
import { MatchLineup } from './match-lineup.entity'
import { MatchSeries } from './match-series.entity'
import { MatchController } from './match.controller'
import { Match } from './match.entity'
import { MatchMapper } from './match.mapper'
import { MatchService } from './match.service'

@Module({
  imports: [
    MikroOrmModule.forFeature([Match, MatchSeries, MatchAttendance, MatchLineup]),
    forwardRef(() => NotificationModule),
  ],
  controllers: [MatchController],
  providers: [MatchService, MatchMapper],
  exports: [MatchService],
})
export class MatchModule {}
