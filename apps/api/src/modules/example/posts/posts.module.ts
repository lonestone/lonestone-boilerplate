import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { PostController, PublicPostController } from './posts.controller'
import { Post, PostVersion } from './posts.entity'
import { PostService } from './posts.service'

@Module({
  imports: [MikroOrmModule.forFeature([Post, PostVersion])],
  controllers: [PostController, PublicPostController],
  providers: [PostService],
  exports: [PostService],
})
export class PostModule {}
