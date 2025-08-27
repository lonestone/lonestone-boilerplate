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
  Optional,
  UseGuards,
} from '@nestjs/common'
import { z } from 'zod'
import { Session } from '../auth/auth.decorator'
import { AuthGuard } from '../auth/auth.guard'
import { CommentsService } from './comments.service'
import {
  CommentFiltering,
  commentFilteringSchema,
  CommentPagination,
  commentPaginationSchema,
  commentSchema,
  CommentSorting,
  commentSortingSchema,
  commentsSchema,
  CreateCommentInput,
  createCommentSchema,
} from './contracts/comments.contract'

@TypedController('posts/:postSlug/comments', z.object({
  postSlug: z.string(),
}))
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @TypedRoute.Post('', commentSchema)
  async createComment(
    @TypedParam('postSlug', z.string()) postSlug: string,
    @TypedBody(createCommentSchema) body: CreateCommentInput,
    @Optional() @Session() session?: { user: { id: string } },
  ) {
    const userId = session?.user?.id
    return await this.commentsService.createComment(postSlug, body, userId)
  }

  @TypedRoute.Get('', commentsSchema)
  async getComments(
    @TypedParam('postSlug', z.string()) postSlug: string,
    @PaginationParams(commentPaginationSchema) pagination: CommentPagination,
    @SortingParams(commentSortingSchema) sort?: CommentSorting,
    @FilteringParams(commentFilteringSchema) filter?: CommentFiltering,
  ) {
    return await this.commentsService.getCommentsByPost(
      postSlug,
      pagination,
      sort,
      filter,
    )
  }

  @TypedRoute.Get('count')
  async getCommentCount(@TypedParam('postSlug', z.string()) postSlug: string) {
    const count = await this.commentsService.getCommentCount(postSlug)
    return { count }
  }

  @TypedRoute.Get(':commentId/replies', commentsSchema)
  async getCommentReplies(
    @TypedParam('commentId', z.string()) commentId: string,
    @PaginationParams(commentPaginationSchema) pagination: CommentPagination,
    @SortingParams(commentSortingSchema) sort?: CommentSorting,
  ) {
    return await this.commentsService.getCommentReplies(
      commentId,
      pagination,
      sort,
    )
  }

  @TypedRoute.Delete(':commentId')
  @UseGuards(AuthGuard)
  async deleteComment(
    @TypedParam('commentId', z.string()) commentId: string,
    @Session() session: { user: { id: string } },
  ) {
    await this.commentsService.deleteComment(commentId, session.user.id)
    return { success: true }
  }
}
