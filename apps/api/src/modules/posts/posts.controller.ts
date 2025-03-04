import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { PostService } from './posts.service';
import { AuthGuard } from '../auth/auth.guard';
import { Session } from '../auth/auth.decorator';
import type { Content } from './posts.entity';

@Controller('posts')
@UseGuards(AuthGuard)
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post()
  async createPost(
    @Session() session: { user: { id: string } },
    @Body() body: { title: string; content: Content[] }
  ) {
    return await this.postService.createPost(
      session.user.id,
      body.title,
      body.content
    );
  }

  @Put(':id')
  async updatePost(
    @Session() session: { user: { id: string } },
    @Param('id') id: string,
    @Body() body: { title: string; content: Content[] }
  ) {
    return await this.postService.updatePost(session.user.id, id, body.title, body.content);
  }

  @Post(':id/publish')
  async publishPost(@Session() session: { user: { id: string } }, @Param('id') id: string) {
    return await this.postService.publishPost(session.user.id, id);
  }

  @Post(':id/unpublish')
  async unpublishPost(@Session() session: { user: { id: string } }, @Param('id') id: string) {
    return await this.postService.unpublishPost(session.user.id, id);
  }

  @Get('')
  async getUserPosts(@Session() session: { user: { id: string } }) {
    return await this.postService.getUserPosts(session.user.id);
  }

  @Get(':id')
  async getPost(@Session() session: { user: { id: string } }, @Param('id') id: string) {
    return await this.postService.getPost(id, session.user.id);
  }
} 

@Controller('public/posts')
export class PublicPostController {
  constructor(private readonly postService: PostService) {}

  @Get(':id')
  async getPost(@Param('id') id: string) {
    return await this.postService.getPublicPost(id);
  }

  @Get()
  async getPosts() {
    return await this.postService.getPublicPosts();
  }
}   