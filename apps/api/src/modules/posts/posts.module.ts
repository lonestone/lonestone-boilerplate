import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Post, PostVersion } from './posts.entity';
import { PostService } from './posts.service';
import { PostController, PublicPostController } from './posts.controller';
import { CommentsModule } from '../comments/comments.module';

@Module({
  imports: [
    MikroOrmModule.forFeature([Post, PostVersion]),
    CommentsModule,
  ],
  controllers: [PostController, PublicPostController],
  providers: [PostService],
  exports: [PostService],
})
export class PostModule {}
