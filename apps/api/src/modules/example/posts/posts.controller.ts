import {
  FilteringParams,
  PaginationParams,
  SortingParams,
  TypedController,
  TypedMultipartBody,
  TypedParam,
  TypedRoute,
} from '@lonestone/nzoth/server'
import {
  HttpCode,
  Param,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiProduces,
} from '@nestjs/swagger'
import { z } from 'zod'
import { LoggedInBetterAuthSession } from '../../auth/auth.config'
import { Session } from '../../auth/auth.decorator'
import { AuthGuard } from '../../auth/auth.guard'
import {
  CreatePostMultipart,
  createPostSchema,
  PostFiltering,
  postFilteringSchema,
  postIdSchema,
  PostPagination,
  postPaginationSchema,
  postSlugSchema,
  PostSorting,
  postSortingSchema,
  publicAuthorPostsSchema,
  publicPostSchema,
  publicPostsSchema,
  toCreatePostInput,
  toUpdatePostInput,
  UpdatePostMultipart,
  updatePostSchema,
  UserPost,
  userPostSchema,
  userPostsSchema,
} from './contracts/posts.contract'
import { parsePostImageFile, POST_COVER_IMAGE_MAX_SIZE_BYTES } from './image-file.util'
import { PostsMapper } from './posts.mapper'
import { PostService } from './posts.service'

const SWAGGER_API_PARAMETERS = 'swagger/apiParameters'

function ApiPostMultipartBody(required: string[]): MethodDecorator {
  const apiBody = ApiBody({
    schema: {
      type: 'object',
      required,
      properties: {
        title: { type: 'string' },
        content: {
          type: 'string',
          description: 'JSON array of post content blocks',
        },
        tags: {
          type: 'string',
          description: 'JSON array of tag names',
        },
        coverImage: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })

  return (target, propertyKey, descriptor): void => {
    if (!descriptor?.value) return

    const existingParameters: unknown = Reflect.getMetadata(
      SWAGGER_API_PARAMETERS,
      descriptor.value,
    )
    const parameters = Array.isArray(existingParameters)
      ? existingParameters.filter((parameter: unknown) => !isBodyParameter(parameter))
      : []

    Reflect.defineMetadata(SWAGGER_API_PARAMETERS, parameters, descriptor.value)
    apiBody(target, propertyKey, descriptor)
  }
}

function isBodyParameter(value: unknown): boolean {
  return typeof value === 'object' && value !== null && 'in' in value && value.in === 'body'
}

function encodeFilename(filename: string): string {
  return encodeURIComponent(filename).replaceAll("'", '%27')
}

@TypedController('admin/posts', undefined, {
  tags: ['Admin Posts'],
})
@UseGuards(AuthGuard)
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly postsMapper: PostsMapper,
  ) {}

  @ApiPostMultipartBody(['title', 'content'])
  @ApiConsumes('multipart/form-data')
  @TypedRoute.Post('', userPostSchema, { status: 201 })
  @UseInterceptors(
    FileInterceptor('coverImage', {
      limits: {
        fileSize: POST_COVER_IMAGE_MAX_SIZE_BYTES,
      },
    }),
  )
  async createPost(
    @Session() session: LoggedInBetterAuthSession,
    @TypedMultipartBody(createPostSchema) body: CreatePostMultipart,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<UserPost> {
    const coverImage = file ? parsePostImageFile(file) : undefined
    const post = await this.postService.createPost(
      session.user.id,
      toCreatePostInput(body),
      coverImage,
    )
    return this.postsMapper.toUserPost(post)
  }

  @ApiPostMultipartBody([])
  @ApiConsumes('multipart/form-data')
  @TypedRoute.Put(':id', userPostSchema)
  @UseInterceptors(
    FileInterceptor('coverImage', {
      limits: {
        fileSize: POST_COVER_IMAGE_MAX_SIZE_BYTES,
      },
    }),
  )
  async updatePost(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('id', z.string()) id: string,
    @TypedMultipartBody(updatePostSchema) body: UpdatePostMultipart,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<UserPost> {
    const coverImage = file ? parsePostImageFile(file) : undefined
    const post = await this.postService.updatePost(
      id,
      session.user.id,
      toUpdatePostInput(body),
      coverImage,
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
    const result = await this.postService.getUserPosts(session.user.id, pagination, sort, filter)
    return this.postsMapper.toUserPosts(result)
  }

  @TypedRoute.Get(':id/cover-image')
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({
    description: 'Post cover image contents',
    content: {
      'application/octet-stream': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async downloadUserPostImage(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('id', postIdSchema) id: string,
  ): Promise<StreamableFile> {
    const image = await this.postService.downloadUserPostImage(id, session.user.id)

    return new StreamableFile(image.object.body, {
      type: image.mimeType,
      length: image.size,
      disposition: `inline; filename*=UTF-8''${encodeFilename(image.filename)}`,
    })
  }

  @TypedRoute.Delete(':id/cover-image')
  @ApiNoContentResponse()
  @HttpCode(204)
  async removeUserPostImage(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('id', postIdSchema) id: string,
  ): Promise<void> {
    await this.postService.removePostImage(id, session.user.id)
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

  @TypedRoute.Get(':slug/cover-image')
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({
    description: 'Published post cover image contents',
    content: {
      'application/octet-stream': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async downloadPublicPostImage(
    @TypedParam('slug', postSlugSchema) slug: string,
  ): Promise<StreamableFile> {
    const image = await this.postService.downloadPublicPostImage(slug)

    return new StreamableFile(image.object.body, {
      type: image.mimeType,
      length: image.size,
      disposition: `inline; filename*=UTF-8''${encodeFilename(image.filename)}`,
    })
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
    const post = await this.postService.likePost(slug)
    const commentCount = 0
    return this.postsMapper.toPublicPost({ post, commentCount })
  }
}

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
