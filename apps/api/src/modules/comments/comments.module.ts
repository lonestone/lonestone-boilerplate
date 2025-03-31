import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { CommentsController } from './comments.controller'
import { Comment } from './comments.entity'
import { CommentsService } from './comments.service'

@Module({
  imports: [
    MikroOrmModule.forFeature([Comment]),
  ],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
