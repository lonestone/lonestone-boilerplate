import { Module } from '@nestjs/common'
import { CommentsController } from './comments.controller'
import { CommentsMapper } from './comments.mapper'
import { CommentsService } from './comments.service'

@Module({
  controllers: [CommentsController],
  providers: [CommentsService, CommentsMapper],
  exports: [CommentsService],
})
export class CommentsModule {}
