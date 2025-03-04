import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { EntityManager, FilterQuery, QueryOrderMap } from '@mikro-orm/core';
import { Comment } from './comments.entity';
import { Post } from '../posts/posts.entity';
import { User } from '../auth/auth.entity';
import { 
  CommentResponse, 
  CommentsResponse, 
  CreateCommentInput, 
  CommentPagination, 
  CommentSorting, 
  CommentFiltering 
} from './contracts/comments.contract';

@Injectable()
export class CommentsService {
  constructor(private readonly em: EntityManager) {}

  async createComment(
    postSlug: string, 
    data: CreateCommentInput, 
    userId?: string
  ): Promise<CommentResponse> {
    const post = await this.em.findOne(Post, { slug: postSlug });
    if (!post) throw new NotFoundException('Post not found');

    const comment = new Comment();
    comment.post = post;
    comment.content = data.content;
    
    // Set user if authenticated
    if (userId) {
      const user = await this.em.findOne(User, { id: userId });
      if (user) {
        comment.user = user;
      }
    } else {
      comment.authorName = 'Anonymous';
    }

    // Handle reply to another comment
    if (data.parentId) {
      const parentComment = await this.em.findOne(Comment, { id: data.parentId, post: post.id });
      if (!parentComment) {
        throw new NotFoundException('Parent comment not found');
      }
      comment.parent = parentComment;
    }

    await this.em.persistAndFlush(comment);

    return this.mapCommentToResponse(comment);
  }

  async getCommentsByPost(
    postSlug: string,
    pagination: CommentPagination,
    sort?: CommentSorting,
    filter?: CommentFiltering
  ): Promise<CommentsResponse> {
    const post = await this.em.findOne(Post, { slug: postSlug });
    if (!post) throw new NotFoundException('Post not found');

    // Only get top-level comments (no parent)
    const whereFilter: FilterQuery<Comment> = { 
      post: post.id,
      parent: null
    };

    // Apply content filter if provided
    if (filter && Array.isArray(filter) && filter.length > 0) {
      const contentFilter = filter.find(f => f.property === 'content');
      if (contentFilter && contentFilter.value) {
        whereFilter.content = { $like: `%${contentFilter.value}%` };
      }
    }

    const orderBy: QueryOrderMap<Comment> = { createdAt: 'DESC' };
    if (sort && Array.isArray(sort) && sort.length > 0) {
      const sortItem = sort[0];
      orderBy[sortItem.property as keyof Comment] = sortItem.direction;
    }

    const [comments, itemCount] = await this.em.findAndCount(
      Comment,
      whereFilter,
      {
        limit: pagination.pageSize,
        offset: pagination.offset,
        orderBy,
        populate: ['user', 'replies']
      }
    );

    // Map comments to response format
    const mappedComments = comments.map(comment => this.mapCommentToResponse(comment));

    return {
      data: mappedComments,
      meta: {
        itemCount,
        pageSize: pagination.pageSize,
        offset: pagination.offset,
        hasMore: itemCount > pagination.offset + pagination.pageSize
      }
    };
  }

  async getCommentReplies(
    commentId: string,
    pagination: CommentPagination,
    sort?: CommentSorting
  ): Promise<CommentsResponse> {
    const comment = await this.em.findOne(Comment, { id: commentId });
    if (!comment) throw new NotFoundException('Comment not found');

    const orderBy: QueryOrderMap<Comment> = { createdAt: 'DESC' };
    if (sort && Array.isArray(sort) && sort.length > 0) {
      const sortItem = sort[0];
      orderBy[sortItem.property as keyof Comment] = sortItem.direction;
    }

    const [replies, itemCount] = await this.em.findAndCount(
      Comment,
      { parent: commentId },
      {
        limit: pagination.pageSize,
        offset: pagination.offset,
        orderBy,
        populate: ['user', 'replies']
      }
    );

    // Map replies to response format
    const mappedReplies = replies.map(reply => this.mapCommentToResponse(reply));

    return {
      data: mappedReplies,
      meta: {
        itemCount,
        pageSize: pagination.pageSize,
        offset: pagination.offset,
        hasMore: itemCount > pagination.offset + pagination.pageSize
      }
    };
  }

  async deleteComment(commentId: string, userId: string): Promise<void> {
    const comment = await this.em.findOne(Comment, { id: commentId }, { populate: ['post', 'post.user'] });
    if (!comment) throw new NotFoundException('Comment not found');

    // Check if user is the post author
    if (comment.post.user.id !== userId) {
      throw new ForbiddenException('Only the post author can delete comments');
    }

    // Delete all replies first
    await this.em.nativeDelete(Comment, { parent: commentId });
    
    // Then delete the comment itself
    await this.em.removeAndFlush(comment);
  }

  async getCommentCount(postSlug: string): Promise<number> {
    const post = await this.em.findOne(Post, { slug: postSlug });
    if (!post) throw new NotFoundException('Post not found');
    return await this.em.count(Comment, { post: post.id });
  }

  private mapCommentToResponse(comment: Comment): CommentResponse {
    const replyIds = comment.replies?.isInitialized() 
      ? comment.replies.getItems().map(reply => reply.id)
      : [];
    
    const replyCount = comment.replies?.isInitialized() 
      ? comment.replies.count()
      : 0;

    return {
      id: comment.id,
      content: comment.content,
      authorName: comment.authorName || null,
      createdAt: comment.createdAt,
      user: comment.user ? {
        id: comment.user.id,
        name: comment.user.name || 'User',
      } : null,
      parentId: comment.parent?.id || null,
      replyIds,
      replyCount,
    };
  }
} 