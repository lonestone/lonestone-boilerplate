import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Post, PostVersion } from './posts.entity';
import { PostService } from './posts.service';
import { PostController, PublicPostController } from './posts.controller';

@Module({
  imports: [
    MikroOrmModule.forFeature([Post, PostVersion]),
  ],
  controllers: [PostController, PublicPostController],
  providers: [PostService],
  exports: [PostService],
})
export class PostModule {}
