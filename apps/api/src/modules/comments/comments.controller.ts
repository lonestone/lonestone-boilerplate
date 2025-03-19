import {
  Controller,
  UseGuards,
  Optional,
} from "@nestjs/common";
import { CommentsService } from "./comments.service";
import { AuthGuard } from "../auth/auth.guard";
import { Session } from "../auth/auth.decorator";
import {
  FilteringParams,
  PaginationParams,
  SortingParams,
  TypedRoute,
  TypedParam,
  TypedBody,
} from "@lonestone/nzoth/server";
import {
  CommentFiltering,
  commentFilteringSchema,
  CommentPagination,
  commentPaginationSchema,
  CommentSorting,
  commentSortingSchema,
  commentSchema,
  commentsSchema,
  createCommentSchema,
  CreateCommentInput,
} from "./contracts/comments.contract";

@Controller("posts/:postSlug/comments")
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @TypedRoute.Post("", commentSchema)
  async createComment(
    @TypedParam("postSlug") postSlug: string,
    @TypedBody(createCommentSchema) body: CreateCommentInput,
    @Optional() @Session() session?: { user: { id: string } }
  ) {
    const userId = session?.user?.id;
    return await this.commentsService.createComment(postSlug, body, userId);
  }

  @TypedRoute.Get("", commentsSchema)
  async getComments(
    @TypedParam("postSlug") postSlug: string,
    @PaginationParams(commentPaginationSchema) pagination: CommentPagination,
    @SortingParams(commentSortingSchema) sort?: CommentSorting,
    @FilteringParams(commentFilteringSchema) filter?: CommentFiltering
  ) {
    return await this.commentsService.getCommentsByPost(
      postSlug,
      pagination,
      sort,
      filter
    );
  }

  @TypedRoute.Get("count")
  async getCommentCount(@TypedParam("postSlug") postSlug: string) {
    const count = await this.commentsService.getCommentCount(postSlug);
    return { count };
  }

  @TypedRoute.Get(":commentId/replies", commentsSchema)
  async getCommentReplies(
    @TypedParam("commentId") commentId: string,
    @PaginationParams(commentPaginationSchema) pagination: CommentPagination,
    @SortingParams(commentSortingSchema) sort?: CommentSorting
  ) {
    return await this.commentsService.getCommentReplies(
      commentId,
      pagination,
      sort
    );
  }

  @TypedRoute.Delete(":commentId")
  @UseGuards(AuthGuard)
  async deleteComment(
    @TypedParam("commentId") commentId: string,
    @Session() session: { user: { id: string } }
  ) {
    await this.commentsService.deleteComment(commentId, session.user.id);
    return { success: true };
  }
} 