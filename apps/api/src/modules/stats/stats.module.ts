import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { MatchStat } from './match-stat.entity'
import { StatsController } from './stats.controller'
import { StatsService } from './stats.service'

@Module({
  imports: [MikroOrmModule.forFeature([MatchStat])],
  controllers: [StatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
