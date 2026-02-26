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
import { z } from 'zod'
import { LoggedInBetterAuthSession } from '../../../config/better-auth.config'
import { Session } from '../../auth/auth.decorator'
import { AuthGuard } from '../../auth/auth.guard'
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
} from './contracts/posts.contract'
import { PostsMapper } from './posts.mapper'
import { PostService } from './posts.service'

@TypedController('admin/posts', undefined, {
  tags: ['Admin Posts'],
})
@UseGuards(AuthGuard)
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly postsMapper: PostsMapper,
  ) {}

  @TypedRoute.Post('', userPostSchema)
  async createPost(
    @Session() session: LoggedInBetterAuthSession,
    @TypedBody(createPostSchema) body: CreatePostInput,
  ): Promise<UserPost> {
    const post = await this.postService.createPost(
      session.user.id,
      body,
    )
    return this.postsMapper.toUserPost(post)
  }

  @TypedRoute.Put(':id', userPostSchema)
  async updatePost(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('id', z.string()) id: string,
    @TypedBody(updatePostSchema) body: UpdatePostInput,
  ): Promise<UserPost> {
    const post = await this.postService.updatePost(
      id,
      session.user.id,
      body,
    )
    return this.postsMapper.toUserPost(post)
  }

  @TypedRoute.Patch(':id/publish')
  async publishPost(
    @Session() session: LoggedInBetterAuthSession,
    @Param('id') id: string,
  ): Promise<UserPost> {
    const post = await this.postService.publishPost(session.user.id, id)
    return this.postsMapper.toUserPost(post)
  }

  @TypedRoute.Patch(':id/unpublish')
  async unpublishPost(
    @Session() session: LoggedInBetterAuthSession,
    @Param('id') id: string,
  ): Promise<UserPost> {
    const post = await this.postService.unpublishPost(session.user.id, id)
    return this.postsMapper.toUserPost(post)
  }

  @TypedRoute.Get('', userPostsSchema)
  async getUserPosts(
    @Session() session: LoggedInBetterAuthSession,
    @PaginationParams(postPaginationSchema) pagination: PostPagination,
    @SortingParams(postSortingSchema) sort?: PostSorting,
    @FilteringParams(postFilteringSchema) filter?: PostFiltering,
  ) {
    const result = await this.postService.getUserPosts(
      session.user.id,
      pagination,
      sort,
      filter,
    )
    return this.postsMapper.toUserPosts(result)
  }

  @TypedRoute.Get(':id', userPostSchema)
  async getUserPost(
    @Session() session: LoggedInBetterAuthSession,
    @Param('id') id: string,
  ): Promise<UserPost> {
    const post = await this.postService.getUserPost(id, session.user.id)
    return this.postsMapper.toUserPost(post)
  }
}

@TypedController('public/posts', undefined, {
  tags: ['Public Posts'],
})
export class PublicPostController {
  constructor(
    private readonly postService: PostService,
    private readonly postsMapper: PostsMapper,
  ) {}

  @TypedRoute.Get('random', publicPostSchema)
  async getRandomPost() {
    const result = await this.postService.getRandomPublicPost()
    return this.postsMapper.toPublicPost(result)
  }

  @TypedRoute.Get(':slug', publicPostSchema)
  async getPost(@TypedParam('slug', z.string()) slug: string) {
    const result = await this.postService.getPublicPost(slug)
    return this.postsMapper.toPublicPost(result)
  }

  @TypedRoute.Get('', publicPostsSchema)
  async getPosts(
    @PaginationParams(postPaginationSchema) pagination: PostPagination,
    @SortingParams(postSortingSchema) sort?: PostSorting,
    @FilteringParams(postFilteringSchema) filter?: PostFiltering,
  ) {
    const result = await this.postService.getPublicPosts(pagination, sort, filter)
    return this.postsMapper.toPublicPosts(result)
  }
}
