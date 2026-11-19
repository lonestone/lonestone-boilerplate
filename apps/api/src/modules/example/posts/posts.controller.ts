import {
  FilteringParams,
  PaginationParams,
  SortingParams,
  TypedBody,
  TypedController,
  TypedMultipartBody,
  TypedParam,
  TypedRoute,
} from '@lonestone/nzoth/server'
import { HttpCode, Param } from '@nestjs/common'
import { ApiNoContentResponse } from '@nestjs/swagger'
import { AllowAnonymous, Session } from '@thallesp/nestjs-better-auth'
import { z } from 'zod'
import { LoggedInBetterAuthSession } from '../../auth/auth.config'
import { MultipartFile } from '../../media/multipart-file.decorator'
import {
  CreatePostInput,
  createPostSchema,
  PostFiltering,
  postFilteringSchema,
  postIdSchema,
  PostPagination,
  postPaginationSchema,
  POST_COVER_IMAGE_MAX_SIZE_BYTES,
  PostSorting,
  postSortingSchema,
  publicAuthorPostsSchema,
  publicPostSchema,
  publicPostsSchema,
  SetCoverImageInput,
  setCoverImageSchema,
  UpdatePostInput,
  UpdatePostMultipartInput,
  updatePostMultipartSchema,
  updatePostSchema,
  UserPost,
  userPostSchema,
  userPostsSchema,
} from './contracts/posts.contract'
import { PostsMapper } from './posts.mapper'
import { PostService } from './posts.service'

// Title, then one field per content item and per tag.
const UPDATE_POST_MULTIPART_MAX_FIELDS = 100

@TypedController('admin/posts', undefined, {
  tags: ['Admin Posts'],
})
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
    const post = await this.postService.createPost(session.user.id, body)
    return this.postsMapper.toUserPost(post)
  }

  @TypedRoute.Put(':id', userPostSchema)
  async updatePost(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('id', z.string()) id: string,
    @TypedBody(updatePostSchema) body: UpdatePostInput,
  ): Promise<UserPost> {
    const post = await this.postService.updatePost(id, session.user.id, body)
    return this.postsMapper.toUserPost(post)
  }

  /**
   * The same update as `PUT /:id`, sent as `multipart/form-data` with an optional cover image.
   *
   * Two ways to send a file exist in this example. `PUT /:id/cover-image` keeps the post in JSON
   * and sends the file on its own route: simplest when one entity has one file. This route sends
   * everything in one request: useful for large forms, or several files on one entity. It stays
   * typed: `updatePostMultipartSchema` declares the file with `z.file()` and the arrays with
   * `multipartArray`, so the controller receives the same typed input as the JSON route.
   */
  @TypedRoute.Put(':id/multipart', userPostSchema)
  @MultipartFile('coverImage', {
    maxSize: POST_COVER_IMAGE_MAX_SIZE_BYTES,
    maxFields: UPDATE_POST_MULTIPART_MAX_FIELDS,
  })
  async updatePostViaMultipart(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('id', postIdSchema) id: string,
    @TypedMultipartBody(updatePostMultipartSchema) body: UpdatePostMultipartInput,
  ): Promise<UserPost> {
    const post = await this.postService.updatePost(id, session.user.id, body)
    return this.postsMapper.toUserPost(post)
  }

  @TypedRoute.Put(':id/cover-image', userPostSchema)
  @MultipartFile('file', { maxSize: POST_COVER_IMAGE_MAX_SIZE_BYTES })
  async setCoverImage(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('id', postIdSchema) id: string,
    @TypedMultipartBody(setCoverImageSchema) body: SetCoverImageInput,
  ): Promise<UserPost> {
    const post = await this.postService.setCoverImage(id, session.user.id, body.file)
    return this.postsMapper.toUserPost(post)
  }

  @TypedRoute.Delete(':id/cover-image')
  @ApiNoContentResponse()
  @HttpCode(204)
  async removeCoverImage(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('id', postIdSchema) id: string,
  ): Promise<void> {
    await this.postService.removeCoverImage(id, session.user.id)
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
    const result = await this.postService.getUserPosts(session.user.id, pagination, sort, filter)
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

@AllowAnonymous()
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

  @TypedRoute.Post(':slug/like', publicPostSchema)
  @HttpCode(200)
  async likePost(@TypedParam('slug', z.string()) slug: string) {
    const result = await this.postService.likePost(slug)
    return this.postsMapper.toPublicPost(result)
  }
}

@AllowAnonymous()
@TypedController('public/authors', undefined, {
  tags: ['Public Authors'],
})
export class PublicAuthorController {
  constructor(
    private readonly postService: PostService,
    private readonly postsMapper: PostsMapper,
  ) {}

  @TypedRoute.Get(':slug/posts', publicAuthorPostsSchema)
  async getAuthorPosts(
    @TypedParam('slug', z.string()) slug: string,
    @PaginationParams(postPaginationSchema) pagination: PostPagination,
    @SortingParams(postSortingSchema) sort?: PostSorting,
  ) {
    const result = await this.postService.getPublicPostsByAuthor(slug, pagination, sort)
    return this.postsMapper.toPublicAuthorPosts(result)
  }
}
