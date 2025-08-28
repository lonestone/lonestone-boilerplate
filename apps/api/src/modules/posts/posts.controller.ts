import {
  FilteringParams,
  PaginationParams,
  SortingParams,
  TypedBody,
  TypedController,
  TypedParam,
  TypedRoute,
} from '@lonestone/nzoth/server'
import {
  Param,
  UseGuards,
} from '@nestjs/common'
import { LoggedInBetterAuthSession } from 'src/config/better-auth.config'
import {
  CreatePostInput,
  createPostSchema,
  PostFiltering,
  postFilteringSchema,
  PostPagination,
  postPaginationSchema,
  PostSorting,
  postSortingSchema,
  publicPostSchema,
  publicPostsSchema,
  UpdatePostInput,
  updatePostSchema,
  UserPost,
  userPostSchema,
  userPostsSchema,
} from 'src/modules/posts/contracts/posts.contract'
import { z } from 'zod'
import { Session } from '../auth/auth.decorator'
import { AuthGuard } from '../auth/auth.guard'
import { PostService } from './posts.service'

@TypedController('admin/posts', undefined, {
  tags: ['Admin Posts'],
})
@UseGuards(AuthGuard)
export class PostController {
  constructor(private readonly postService: PostService) {}

  @TypedRoute.Post('', userPostSchema)
  async createPost(
    @Session() session: LoggedInBetterAuthSession,
    @TypedBody(createPostSchema) body: CreatePostInput,
  ): Promise<UserPost> {
    return await this.postService.createPost(
      session.user.id,
      body,
    )
  }

  @TypedRoute.Put(':id', userPostSchema)
  async updatePost(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('id', z.string()) id: string,
    @TypedBody(updatePostSchema) body: UpdatePostInput,
  ) {
    return await this.postService.updatePost(
      id,
      session.user.id,
      body,
    )
  }

  @TypedRoute.Patch(':id/publish')
  async publishPost(
    @Session() session: LoggedInBetterAuthSession,
    @Param('id') id: string,
  ) {
    return await this.postService.publishPost(session.user.id, id)
  }

  @TypedRoute.Patch(':id/unpublish')
  async unpublishPost(
    @Session() session: LoggedInBetterAuthSession,
    @Param('id') id: string,
  ) {
    return await this.postService.unpublishPost(session.user.id, id)
  }

  @TypedRoute.Get('', userPostsSchema)
  async getUserPosts(
    @Session() session: LoggedInBetterAuthSession,
    @PaginationParams(postPaginationSchema) pagination: PostPagination,
    @SortingParams(postSortingSchema) sort?: PostSorting,
    @FilteringParams(postFilteringSchema) filter?: PostFiltering,
  ) {
    return await this.postService.getUserPosts(session.user.id, pagination, sort, filter)
  }

  @TypedRoute.Get(':id', userPostSchema)
  async getUserPost(
    @Session() session: LoggedInBetterAuthSession,
    @Param('id') id: string,
  ) {
    return await this.postService.getUserPost(id, session.user.id)
  }
}

@TypedController('public/posts', undefined, {
  tags: ['Public Posts'],
})
export class PublicPostController {
  constructor(private readonly postService: PostService) {}

  @TypedRoute.Get('random', publicPostSchema)
  async getRandomPost() {
    return await this.postService.getRandomPublicPost()
  }

  @TypedRoute.Get(':slug', publicPostSchema)
  async getPost(@TypedParam('slug', z.string()) slug: string) {
    return await this.postService.getPublicPost(slug)
  }

  @TypedRoute.Get('', publicPostsSchema)
  async getPosts(
    @PaginationParams(postPaginationSchema) pagination: PostPagination,
    @SortingParams(postSortingSchema) sort?: PostSorting,
    @FilteringParams(postFilteringSchema) filter?: PostFiltering,
  ) {
    return await this.postService.getPublicPosts(pagination, sort, filter)
  }
}
