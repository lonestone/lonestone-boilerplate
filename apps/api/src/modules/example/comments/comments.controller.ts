import {
  FilteringParams,
  PaginationParams,
  SortingParams,
  TypedBody,
  TypedController,
  TypedParam,
  TypedRoute,
} from '@lonestone/nzoth/server'
import { AllowAnonymous, OptionalAuth, Session } from '@thallesp/nestjs-better-auth'
import { z } from 'zod'
import { CommentsMapper } from './comments.mapper'
import { CommentsService } from './comments.service'
import {
  CommentFiltering,
  commentFilteringSchema,
  CommentPagination,
  commentPaginationSchema,
  CommentResponse,
  commentSchema,
  CommentSorting,
  commentSortingSchema,
  CommentsResponse,
  commentsSchema,
  CreateCommentInput,
  createCommentSchema,
} from './contracts/comments.contract'

@TypedController(
  'posts/:postSlug/comments',
  z.object({
    postSlug: z.string(),
  }),
)
export class CommentsController {
  constructor(
    private readonly commentsService: CommentsService,
    private readonly commentsMapper: CommentsMapper,
  ) {}

  @OptionalAuth()
  @TypedRoute.Post('', commentSchema)
  async createComment(
    @TypedParam('postSlug', z.string()) postSlug: string,
    @TypedBody(createCommentSchema) body: CreateCommentInput,
    @Session() session?: { user: { id: string } },
  ): Promise<CommentResponse> {
    const userId = session?.user?.id
    const comment = await this.commentsService.createComment(postSlug, body, userId)
    return this.commentsMapper.toComment(comment)
  }

  @AllowAnonymous()
  @TypedRoute.Get('', commentsSchema)
  async getComments(
    @TypedParam('postSlug', z.string()) postSlug: string,
    @PaginationParams(commentPaginationSchema) pagination: CommentPagination,
    @SortingParams(commentSortingSchema) sort?: CommentSorting,
    @FilteringParams(commentFilteringSchema) filter?: CommentFiltering,
  ): Promise<CommentsResponse> {
    const result = await this.commentsService.getCommentsByPost(postSlug, pagination, sort, filter)
    return this.commentsMapper.toCommentsResponse(result)
  }

  @AllowAnonymous()
  @TypedRoute.Get('count')
  async getCommentCount(@TypedParam('postSlug', z.string()) postSlug: string) {
    const count = await this.commentsService.getCommentCount(postSlug)
    return { count }
  }

  @AllowAnonymous()
  @TypedRoute.Get(':commentId/replies', commentsSchema)
  async getCommentReplies(
    @TypedParam('commentId', z.string()) commentId: string,
    @PaginationParams(commentPaginationSchema) pagination: CommentPagination,
    @SortingParams(commentSortingSchema) sort?: CommentSorting,
  ): Promise<CommentsResponse> {
    const result = await this.commentsService.getCommentReplies(commentId, pagination, sort)
    return this.commentsMapper.toCommentsResponse(result)
  }

  @TypedRoute.Delete(':commentId')
  async deleteComment(
    @TypedParam('commentId', z.string()) commentId: string,
    @Session() session: { user: { id: string } },
  ) {
    await this.commentsService.deleteComment(commentId, session.user.id)
    return { success: true }
  }
}
