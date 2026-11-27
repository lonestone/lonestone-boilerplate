import type { LoggedInBetterAuthSession } from '../../auth/auth.config'
import type {
  CreatePostInput,
  PostFiltering,
  PostPagination,
  PostSorting,
  SetCoverImageInput,
  UpdatePostInput,
  UpdatePostMultipartInput,
  UserPost,
} from './contracts/posts.contract'
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Patch,
  Query,
  SerializeOptions,
} from '@nestjs/common'
import {
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger'
import { AllowAnonymous, Session } from '@thallesp/nestjs-better-auth'
import { z } from 'zod'
import { MultipartFile } from '../../media/multipart-file.decorator'
import {
  createPostSchema,
  postFilteringSchema,
  postIdSchema,
  postPaginationSchema,
  POST_COVER_IMAGE_MAX_SIZE_BYTES,
  postSortingSchema,
  publicAuthorPostsSchema,
  publicPostSchema,
  publicPostsSchema,
  setCoverImageSchema,
  updatePostMultipartSchema,
  updatePostSchema,
  userPostSchema,
  userPostsSchema,
} from './contracts/posts.contract'
import { PostsMapper } from './posts.mapper'
import { PostService } from './posts.service'

// Title, then one field per content item and per tag.
const UPDATE_POST_MULTIPART_MAX_FIELDS = 100

@ApiTags('Admin Posts')
@Controller('admin/posts')
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly postsMapper: PostsMapper,
  ) {}

  @Post()
  @SerializeOptions({ schema: userPostSchema })
  @ApiCreatedResponse({ standardSchema: userPostSchema })
  async createPost(
    @Session() session: LoggedInBetterAuthSession,
    @Body({ schema: createPostSchema }) body: CreatePostInput,
  ): Promise<UserPost> {
    const post = await this.postService.createPost(session.user.id, body)
    return this.postsMapper.toUserPost(post)
  }

  @Put(':id')
  @SerializeOptions({ schema: userPostSchema })
  @ApiOkResponse({ standardSchema: userPostSchema })
  async updatePost(
    @Session() session: LoggedInBetterAuthSession,
    @Param('id', { schema: z.string() }) id: string,
    @Body({ schema: updatePostSchema }) body: UpdatePostInput,
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
  @Put(':id/multipart')
  @ApiConsumes('multipart/form-data')
  @MultipartFile('coverImage', {
    maxSize: POST_COVER_IMAGE_MAX_SIZE_BYTES,
    maxFields: UPDATE_POST_MULTIPART_MAX_FIELDS,
  })
  @SerializeOptions({ schema: userPostSchema })
  @ApiOkResponse({ standardSchema: userPostSchema })
  async updatePostViaMultipart(
    @Session() session: LoggedInBetterAuthSession,
    @Param('id', { schema: postIdSchema }) id: string,
    @Body({ schema: updatePostMultipartSchema }) body: UpdatePostMultipartInput,
  ): Promise<UserPost> {
    const post = await this.postService.updatePost(id, session.user.id, body)
    return this.postsMapper.toUserPost(post)
  }

  @Put(':id/cover-image')
  @ApiConsumes('multipart/form-data')
  @MultipartFile('file', { maxSize: POST_COVER_IMAGE_MAX_SIZE_BYTES })
  @SerializeOptions({ schema: userPostSchema })
  @ApiOkResponse({ standardSchema: userPostSchema })
  async setCoverImage(
    @Session() session: LoggedInBetterAuthSession,
    @Param('id', { schema: postIdSchema }) id: string,
    @Body({ schema: setCoverImageSchema }) body: SetCoverImageInput,
  ): Promise<UserPost> {
    const post = await this.postService.setCoverImage(id, session.user.id, body.file)
    return this.postsMapper.toUserPost(post)
  }

  @Delete(':id/cover-image')
  @HttpCode(204)
  @ApiNoContentResponse()
  async removeCoverImage(
    @Session() session: LoggedInBetterAuthSession,
    @Param('id', { schema: postIdSchema }) id: string,
  ): Promise<void> {
    await this.postService.removeCoverImage(id, session.user.id)
  }

  @Patch(':id/publish')
  @SerializeOptions({ schema: userPostSchema })
  @ApiOkResponse({ standardSchema: userPostSchema })
  async publishPost(
    @Session() session: LoggedInBetterAuthSession,
    @Param('id') id: string,
  ): Promise<UserPost> {
    const post = await this.postService.publishPost(session.user.id, id)
    return this.postsMapper.toUserPost(post)
  }

  @Patch(':id/unpublish')
  @SerializeOptions({ schema: userPostSchema })
  @ApiOkResponse({ standardSchema: userPostSchema })
  async unpublishPost(
    @Session() session: LoggedInBetterAuthSession,
    @Param('id') id: string,
  ): Promise<UserPost> {
    const post = await this.postService.unpublishPost(session.user.id, id)
    return this.postsMapper.toUserPost(post)
  }

  @Get()
  @SerializeOptions({ schema: userPostsSchema })
  @ApiOkResponse({ standardSchema: userPostsSchema })
  @ApiQuery({ name: 'sort', required: false })
  @ApiQuery({ name: 'filter', required: false })
  async getUserPosts(
    @Session() session: LoggedInBetterAuthSession,
    @Query({ schema: postPaginationSchema }) pagination: PostPagination,
    @Query('sort', { schema: postSortingSchema }) sort?: PostSorting,
    @Query('filter', { schema: postFilteringSchema }) filter?: PostFiltering,
  ) {
    const result = await this.postService.getUserPosts(session.user.id, pagination, sort, filter)
    return this.postsMapper.toUserPosts(result)
  }

  @Get(':id')
  @SerializeOptions({ schema: userPostSchema })
  @ApiOkResponse({ standardSchema: userPostSchema })
  async getUserPost(
    @Session() session: LoggedInBetterAuthSession,
    @Param('id') id: string,
  ): Promise<UserPost> {
    const post = await this.postService.getUserPost(id, session.user.id)
    return this.postsMapper.toUserPost(post)
  }
}

@AllowAnonymous()
@ApiTags('Public Posts')
@Controller('public/posts')
export class PublicPostController {
  constructor(
    private readonly postService: PostService,
    private readonly postsMapper: PostsMapper,
  ) {}

  @Get('random')
  @SerializeOptions({ schema: publicPostSchema })
  @ApiOkResponse({ standardSchema: publicPostSchema })
  async getRandomPost() {
    const result = await this.postService.getRandomPublicPost()
    return this.postsMapper.toPublicPost(result)
  }

  @Get(':slug')
  @SerializeOptions({ schema: publicPostSchema })
  @ApiOkResponse({ standardSchema: publicPostSchema })
  async getPost(@Param('slug', { schema: z.string() }) slug: string) {
    const result = await this.postService.getPublicPost(slug)
    return this.postsMapper.toPublicPost(result)
  }

  @Get()
  @SerializeOptions({ schema: publicPostsSchema })
  @ApiOkResponse({ standardSchema: publicPostsSchema })
  @ApiQuery({ name: 'sort', required: false })
  @ApiQuery({ name: 'filter', required: false })
  async getPosts(
    @Query({ schema: postPaginationSchema }) pagination: PostPagination,
    @Query('sort', { schema: postSortingSchema }) sort?: PostSorting,
    @Query('filter', { schema: postFilteringSchema }) filter?: PostFiltering,
  ) {
    const result = await this.postService.getPublicPosts(pagination, sort, filter)
    return this.postsMapper.toPublicPosts(result)
  }

  @Post(':slug/like')
  @HttpCode(200)
  @SerializeOptions({ schema: publicPostSchema })
  @ApiOkResponse({ standardSchema: publicPostSchema })
  async likePost(@Param('slug', { schema: z.string() }) slug: string) {
    const result = await this.postService.likePost(slug)
    return this.postsMapper.toPublicPost(result)
  }
}

@AllowAnonymous()
@ApiTags('Public Authors')
@Controller('public/authors')
export class PublicAuthorController {
  constructor(
    private readonly postService: PostService,
    private readonly postsMapper: PostsMapper,
  ) {}

  @Get(':slug/posts')
  @SerializeOptions({ schema: publicAuthorPostsSchema })
  @ApiOkResponse({ standardSchema: publicAuthorPostsSchema })
  @ApiQuery({ name: 'sort', required: false })
  async getAuthorPosts(
    @Param('slug', { schema: z.string() }) slug: string,
    @Query({ schema: postPaginationSchema }) pagination: PostPagination,
    @Query('sort', { schema: postSortingSchema }) sort?: PostSorting,
  ) {
    const result = await this.postService.getPublicPostsByAuthor(slug, pagination, sort)
    return this.postsMapper.toPublicAuthorPosts(result)
  }
}
