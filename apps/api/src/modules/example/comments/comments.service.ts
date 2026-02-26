import { EntityManager, FilterQuery, QueryOrderMap } from '@mikro-orm/core'
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { User } from '../../auth/auth.entity'
import { buildOrderBy } from '../../db/query-order.util'
import { Post } from '../../example/posts/posts.entity'
import { Comment } from './comments.entity'
import {
  CommentFiltering,
  CommentPagination,
  CommentSorting,
  CreateCommentInput,
} from './contracts/comments.contract'

export interface CommentsResult {
  comments: Comment[]
  itemCount: number
  pagination: CommentPagination
}

@Injectable()
export class CommentsService {
  constructor(private readonly em: EntityManager) {}

  async createComment(
    postSlug: string,
    data: CreateCommentInput,
    userId?: string,
  ): Promise<Comment> {
    const post = await this.em.findOne(Post, { slug: postSlug })
    if (!post)
      throw new NotFoundException('Post not found')

    const comment = new Comment()
    comment.post = post
    comment.content = data.content

    // Set user if authenticated
    if (userId) {
      const user = await this.em.findOne(User, { id: userId })
      if (user) {
        comment.user = user
      }
    }
    else {
      comment.authorName = 'Anonymous'
    }

    // Handle reply to another comment
    if (data.parentId) {
      const parentComment = await this.em.findOne(Comment, { id: data.parentId, post: post.id })
      if (!parentComment) {
        throw new NotFoundException('Parent comment not found')
      }
      comment.parent = parentComment
    }

    await this.em.persistAndFlush(comment)

    return comment
  }

  async getCommentsByPost(
    postSlug: string,
    pagination: CommentPagination,
    sort?: CommentSorting,
    filter?: CommentFiltering,
  ): Promise<CommentsResult> {
    const post = await this.em.findOne(Post, { slug: postSlug })
    if (!post)
      throw new NotFoundException('Post not found')

    // Only get top-level comments (no parent)
    const whereFilter: FilterQuery<Comment> = {
      post: post.id,
      parent: null,
    }

    // Apply content filter if provided
    if (filter && Array.isArray(filter) && filter.length > 0) {
      const contentFilter = filter.find(f => f.property === 'content')
      if (contentFilter && contentFilter.value) {
        whereFilter.content = { $like: `%${contentFilter.value}%` }
      }
    }

    const orderBy: QueryOrderMap<Comment> = buildOrderBy({
      sort,
      allowedProperties: ['createdAt', 'authorName'] as const,
      defaultProperty: 'createdAt',
    })

    const [comments, itemCount] = await this.em.findAndCount(
      Comment,
      whereFilter,
      {
        limit: pagination.pageSize,
        offset: pagination.offset,
        orderBy,
        populate: ['user', 'replies'],
      },
    )

    return {
      comments,
      itemCount,
      pagination,
    }
  }

  async getCommentReplies(
    commentId: string,
    pagination: CommentPagination,
    sort?: CommentSorting,
  ): Promise<CommentsResult> {
    const comment = await this.em.findOne(Comment, { id: commentId })
    if (!comment)
      throw new NotFoundException('Comment not found')

    const orderBy: QueryOrderMap<Comment> = buildOrderBy({
      sort,
      allowedProperties: ['createdAt', 'authorName'] as const,
      defaultProperty: 'createdAt',
    })

    const [replies, itemCount] = await this.em.findAndCount(
      Comment,
      { parent: commentId },
      {
        limit: pagination.pageSize,
        offset: pagination.offset,
        orderBy,
        populate: ['user', 'replies'],
      },
    )

    return {
      comments: replies,
      itemCount,
      pagination,
    }
  }

  async deleteComment(commentId: string, userId: string): Promise<void> {
    const comment = await this.em.findOne(Comment, { id: commentId }, { populate: ['post', 'post.user'] })
    if (!comment)
      throw new NotFoundException('Comment not found')

    // Check if user is the post author
    if (comment.post.user.id !== userId) {
      throw new ForbiddenException('Only the post author can delete comments')
    }

    // Delete all replies first
    await this.em.nativeDelete(Comment, { parent: commentId })

    // Then delete the comment itself
    await this.em.removeAndFlush(comment)
  }

  async getCommentCount(postSlug: string): Promise<number> {
    const post = await this.em.findOne(Post, { slug: postSlug })
    if (!post)
      throw new NotFoundException('Post not found')
    return await this.em.count(Comment, { post: post.id })
  }
}
