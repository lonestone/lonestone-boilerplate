import { Module } from '@nestjs/common'
import { PostController, PublicPostController } from './posts.controller'
import { PostService } from './posts.service'

@Module({
  controllers: [PostController, PublicPostController],
  providers: [PostService],
  exports: [PostService],
})
export class PostModule {}
