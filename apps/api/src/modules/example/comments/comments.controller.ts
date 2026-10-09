import {
  Body,
  Controller,
  Delete,
  Get,
  Optional,
  Param,
  Patch,
  Post,
  Query,
  SerializeOptions,
  UseGuards,
} from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { Session } from '../../auth/auth.decorator'
import { AuthGuard } from '../../auth/auth.guard'
import { CommentsMapper } from './comments.mapper'
import { CommentsService } from './comments.service'
import type {
  CommentFiltering,
  CommentPagination,
  CommentResponse,
  CommentSorting,
  CommentsResponse,
  CreateCommentInput,
  UpdateCommentInput,
} from './contracts/comments.contract'
import {
  commentFilteringSchema,
  commentPaginationSchema,
  commentSchema,
  commentSortingSchema,
  commentsSchema,
  createCommentSchema,
  updateCommentSchema,
} from './contracts/comments.contract'

@ApiTags('Comments')
@Controller('posts/:postSlug/comments')
export class CommentsController {
  constructor(
    private readonly commentsService: CommentsService,
    private readonly commentsMapper: CommentsMapper,
  ) {}

  @Post()
  @SerializeOptions({ schema: commentSchema })
  @ApiCreatedResponse({ standardSchema: commentSchema })
  async createComment(
    @Param('postSlug', { schema: z.string() }) postSlug: string,
    @Body({ schema: createCommentSchema }) body: CreateCommentInput,
    @Optional() @Session() session?: { user: { id: string } },
  ): Promise<CommentResponse> {
    const userId = session?.user?.id
    const comment = await this.commentsService.createComment(postSlug, body, userId)
    return this.commentsMapper.toComment(comment)
  }

  @Patch(':commentId')
  @UseGuards(AuthGuard)
  @SerializeOptions({ schema: commentSchema })
  @ApiOkResponse({ standardSchema: commentSchema })
  async updateComment(
    @Param('postSlug', { schema: z.string() }) postSlug: string,
    @Param('commentId', { schema: z.string() }) commentId: string,
    @Body({ schema: updateCommentSchema }) body: UpdateCommentInput,
    @Session() session: { user: { id: string } },
  ): Promise<CommentResponse> {
    const comment = await this.commentsService.updateComment(
      postSlug,
      commentId,
      session.user.id,
      body,
    )
    return this.commentsMapper.toComment(comment)
  }

  @Get()
  @SerializeOptions({ schema: commentsSchema })
  @ApiOkResponse({ standardSchema: commentsSchema })
  @ApiQuery({ name: 'sort', required: false })
  @ApiQuery({ name: 'filter', required: false })
  async getComments(
    @Param('postSlug', { schema: z.string() }) postSlug: string,
    @Query({ schema: commentPaginationSchema }) pagination: CommentPagination,
    @Query('sort', { schema: commentSortingSchema }) sort?: CommentSorting,
    @Query('filter', { schema: commentFilteringSchema }) filter?: CommentFiltering,
  ): Promise<CommentsResponse> {
    const result = await this.commentsService.getCommentsByPost(postSlug, pagination, sort, filter)
    return this.commentsMapper.toCommentsResponse(result)
  }

  @Get('count')
  async getCommentCount(@Param('postSlug', { schema: z.string() }) postSlug: string) {
    const count = await this.commentsService.getCommentCount(postSlug)
    return { count }
  }

  @Get(':commentId/replies')
  @SerializeOptions({ schema: commentsSchema })
  @ApiOkResponse({ standardSchema: commentsSchema })
  @ApiParam({ name: 'postSlug', type: String })
  @ApiQuery({ name: 'sort', required: false })
  async getCommentReplies(
    @Param('commentId', { schema: z.string() }) commentId: string,
    @Query({ schema: commentPaginationSchema }) pagination: CommentPagination,
    @Query('sort', { schema: commentSortingSchema }) sort?: CommentSorting,
  ): Promise<CommentsResponse> {
    const result = await this.commentsService.getCommentReplies(commentId, pagination, sort)
    return this.commentsMapper.toCommentsResponse(result)
  }

  @Delete(':commentId')
  @UseGuards(AuthGuard)
  @ApiParam({ name: 'postSlug', type: String })
  async deleteComment(
    @Param('commentId', { schema: z.string() }) commentId: string,
    @Session() session: { user: { id: string } },
  ) {
    await this.commentsService.deleteComment(commentId, session.user.id)
    return { success: true }
  }
}
