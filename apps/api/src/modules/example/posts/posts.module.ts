import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { MediaModule } from '../../media/media.module'
import { Tag } from '../tags/tag.entity'
import { PostController, PublicAuthorController, PublicPostController } from './posts.controller'
import { Post, PostVersion } from './posts.entity'
import { PostsMapper } from './posts.mapper'
import { PostService } from './posts.service'

@Module({
  imports: [MikroOrmModule.forFeature([Post, PostVersion, Tag]), MediaModule],
  controllers: [PostController, PublicPostController, PublicAuthorController],
  providers: [PostService, PostsMapper],
  exports: [PostService],
})
export class PostModule {}
