import { Injectable } from '@nestjs/common'
import { Comment } from './comments.entity'
import { CommentsResult } from './comments.service'
import {
  CommentResponse,
  CommentsResponse,
} from './contracts/comments.contract'

@Injectable()
export class CommentsMapper {
  toComment(comment: Comment): CommentResponse {
    const replyIds = comment.replies.isInitialized()
      ? comment.replies.getItems().map(reply => reply.id)
      : []

    const replyCount = comment.replies.isInitialized()
      ? comment.replies.count()
      : 0

    return {
      id: comment.id,
      content: comment.content,
      authorName: comment.authorName ?? null,
      createdAt: comment.createdAt,
      user: comment.user
        ? {
            id: comment.user.id,
            name: comment.user.name || 'User',
          }
        : null,
      parentId: comment.parent?.id ?? null,
      replyIds,
      replyCount,
    }
  }

  toCommentsResponse({
    comments,
    itemCount,
    pagination,
  }: CommentsResult): CommentsResponse {
    return {
      data: comments.map(comment => this.toComment(comment)),
      meta: {
        itemCount,
        pageSize: pagination.pageSize,
        offset: pagination.offset,
        hasMore: itemCount > pagination.offset + pagination.pageSize,
      },
    }
  }
}
