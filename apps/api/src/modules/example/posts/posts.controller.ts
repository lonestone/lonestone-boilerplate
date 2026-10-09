import type { LoggedInBetterAuthSession } from '../../auth/auth.config'
import type {
  CreatePostInput,
  PostFiltering,
  PostPagination,
  PostSorting,
  UpdatePostInput,
  UserPost,
} from './contracts/posts.contract'
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Patch,
  Query,
  SerializeOptions,
  UseGuards,
} from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { Session } from '../../auth/auth.decorator'
import { AuthGuard } from '../../auth/auth.guard'
import {
  createPostSchema,
  postFilteringSchema,
  postPaginationSchema,
  postSortingSchema,
  publicAuthorPostsSchema,
  publicPostSchema,
  publicPostsSchema,
  updatePostSchema,
  userPostSchema,
  userPostsSchema,
} from './contracts/posts.contract'
import { PostsMapper } from './posts.mapper'
import { PostService } from './posts.service'

@ApiTags('Admin Posts')
@Controller('admin/posts')
@UseGuards(AuthGuard)
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
    const post = await this.postService.likePost(slug)
    const commentCount = 0
    return this.postsMapper.toPublicPost({ post, commentCount })
  }
}

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
  async getAuthorPosts(
    @Param('slug', { schema: z.string() }) slug: string,
    @Query({ schema: postPaginationSchema }) pagination: PostPagination,
    @Query('sort', { schema: postSortingSchema }) sort?: PostSorting,
  ) {
    const result = await this.postService.getPublicPostsByAuthor(slug, pagination, sort)
    return this.postsMapper.toPublicAuthorPosts(result)
  }
}
