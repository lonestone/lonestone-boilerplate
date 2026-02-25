import type {
  CommentFiltering,
  CommentPagination,
  CommentResponse,
  CommentSorting,
  CreateCommentInput,
} from './contracts/comments.contract'
import { and, desc, eq, isNull, like, sql } from 'drizzle-orm'
import { Elysia } from 'elysia'
import { user } from 'src/modules/db/schemas/auth.schema'
import { dbModule } from '../../db/db.module'
import { comments } from '../../db/schemas/example/comments.schema'
import { posts } from '../../db/schemas/example/posts.schema'

export const CommentsService = new Elysia({ name: 'Comments.Service' })
  .use(dbModule)
  .derive({ as: 'scoped' }, ({ db }) => {
    async function createComment(postSlug: string, data: CreateCommentInput, userId?: string): Promise<CommentResponse> {
      const post = await db.select().from(posts).where(eq(posts.slug, postSlug)).limit(1).then(result => result[0])
      if (!post)
        throw new Error('Post not found')

      let userdata = null
      if (userId) {
        userdata = await db.select().from(user).where(eq(user.id, userId)).limit(1).then(result => result[0])
      }

      // Verify parent comment if provided
      if (data.parentId) {
        const parentComment = await db.select().from(comments).where(and(eq(comments.id, data.parentId), eq(comments.postId, post.id))).limit(1).then(result => result[0])
        if (!parentComment)
          throw new Error('Parent comment not found')
      }

      const [newComment] = await db.insert(comments).values({
        postId: post.id,
        userId: userdata?.id,
        content: data.content,
        authorName: userdata ? null : 'Anonymous',
        parentId: data.parentId,
      }).returning()

      return {
        ...newComment,
        user: userdata ? { id: userdata.id, name: userdata.name } : null,
        replyIds: [],
        replyCount: 0,
      }
    }

    type CommentWithRelations = typeof comments.$inferSelect & {
      user?: typeof user.$inferSelect | null
      replies?: CommentWithRelations[]
    }

    function mapComment(comment: CommentWithRelations): CommentResponse {
      return {
        id: comment.id,
        content: comment.content,
        authorName: comment.authorName,
        createdAt: comment.createdAt,
        user: comment.user ? { id: comment.user.id, name: comment.user.name } : null,
        parentId: comment.parentId,
        replyIds: (comment.replies ?? []).map(reply => reply.id),
        replyCount: (comment.replies ?? []).length,
      }
    }

    async function getCommentsByPost(postSlug: string, pagination: CommentPagination, sort?: CommentSorting, filter?: CommentFiltering): Promise<{
      data: CommentResponse[]
      meta: {
        itemCount: number
        pageSize: number
        offset: number
        hasMore: boolean
      }
    }> {
      const post = await db.query.posts.findFirst({
        where: eq(posts.slug, postSlug),
      })
      if (!post)
        throw new Error('Post not found')

      // Only get top-level comments (no parent)
      const conditions = [eq(comments.postId, post.id), isNull(comments.parentId)]

      // Apply content filter if provided
      if (filter && Array.isArray(filter) && filter.length > 0) {
        const contentFilter = filter.find(f => f.property === 'content')
        if (contentFilter && contentFilter.value) {
          conditions.push(like(comments.content, `%${contentFilter.value}%`))
        }
      }

      const where = and(...conditions)

      const commentsData = await db.query.comments.findMany({
        where,
        with: { user: true, replies: { with: { user: true, replies: true } } },
        orderBy: [desc(comments.createdAt)],
        limit: pagination.limit,
        offset: pagination.page * pagination.limit,
      })

      const [{ count: itemCount }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(comments)
        .where(where)

      return {
        data: commentsData.map(mapComment),
        meta: {
          itemCount,
          pageSize: pagination.limit,
          offset: pagination.page * pagination.limit,
          hasMore: itemCount > pagination.page * pagination.limit + pagination.limit,
        },
      }
    }

    async function getCommentReplies(commentId: string, pagination: CommentPagination, _sort?: CommentSorting): Promise<{
      data: CommentResponse[]
      meta: {
        itemCount: number
        pageSize: number
        offset: number
        hasMore: boolean
      }
    }> {
      const comment = await db.query.comments.findFirst({
        where: eq(comments.id, commentId),
      })
      if (!comment)
        throw new Error('Comment not found')

      const where = eq(comments.parentId, commentId)

      const replies = await db.query.comments.findMany({
        where,
        with: { user: true, replies: { with: { user: true, replies: true } } },
        orderBy: [desc(comments.createdAt)],
        limit: pagination.limit,
        offset: pagination.page * pagination.limit,
      })

      const [{ count: itemCount }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(comments)
        .where(where)

      return {
        data: replies.map(mapComment),
        meta: {
          itemCount,
          pageSize: pagination.limit,
          offset: pagination.page * pagination.limit,
          hasMore: itemCount > pagination.page * pagination.limit + pagination.limit,
        },
      }
    }

    async function deleteComment(commentId: string, userId?: string): Promise<void> {
      const comment = await db.query.comments.findFirst({
        where: eq(comments.id, commentId),
        with: { post: { with: { user: true } } },
      })
      if (!comment)
        throw new Error('Comment not found')

      // Check if user is the post author
      if (comment.post.user.id !== userId) {
        throw new Error('Only the post author can delete comments')
      }

      // Delete all replies first
      await db.delete(comments).where(eq(comments.parentId, commentId))

      // Then delete the comment itself
      await db.delete(comments).where(eq(comments.id, commentId))
    }

    async function getCommentCount(postSlug: string): Promise<number> {
      const post = await db.query.posts.findFirst({
        where: eq(posts.slug, postSlug),
      })
      if (!post)
        throw new Error('Post not found')

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(comments)
        .where(eq(comments.postId, post.id))

      return count
    }

    return {
      createComment,
      getCommentsByPost,
      getCommentReplies,
      deleteComment,
      getCommentCount,
    }
  })
