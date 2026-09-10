import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { SeasonController } from './season.controller'
import { Season } from './season.entity'
import { SeasonMapper } from './season.mapper'
import { SeasonService } from './season.service'

@Module({
  imports: [MikroOrmModule.forFeature([Season])],
  controllers: [SeasonController],
  providers: [SeasonService, SeasonMapper],
  exports: [SeasonService],
})
export class SeasonModule {}
