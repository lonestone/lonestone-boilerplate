import { Module } from '@nestjs/common'
import { ClubController } from './club.controller'

@Module({
  controllers: [ClubController],
})
export class ClubModule {}
