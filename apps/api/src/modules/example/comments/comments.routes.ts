import { Elysia, t } from 'elysia'
import { AuthMacro } from '../../auth/auth.macro'
import { authModule } from '../../auth/auth.module'
import { CommentsService } from './comments.service'
import {
  commentFilteringSchema,
  commentPaginationSchema,
  commentSortingSchema,
  createCommentSchema,
} from './contracts/comments.contract'

export const commentsRoutes = new Elysia({ prefix: '/posts/:postSlug/comments' })
  .use(authModule)
  .use(AuthMacro)
  .use(CommentsService)
  // POST /posts/:postSlug/comments - Create a comment
  .post('/', async ({ params, body, authService, request, createComment }) => {
    const session = await authService.api.getSession({ headers: request.headers })
    const userId = session?.user?.id
    return createComment(params.postSlug, body, userId)
  }, {
    params: t.Object({ postSlug: t.String() }),
    body: createCommentSchema,
    detail: { tags: ['Comments'], summary: 'Create a comment' },
  })

  // GET /posts/:postSlug/comments - Get comments for a post
  .get('/', async ({ params, query, getCommentsByPost }) => {
    const pagination = commentPaginationSchema.parse(query)
    const sorting = commentSortingSchema.optional().parse(query.sort)
    const filtering = commentFilteringSchema.optional().parse(query.filter)
    return getCommentsByPost(params.postSlug, pagination, sorting, filtering)
  }, {
    params: t.Object({ postSlug: t.String() }),
    detail: { tags: ['Comments'], summary: 'Get comments for a post' },
  })

  // GET /posts/:postSlug/comments/count - Get comment count for a post
  .get('/count', async ({ params, getCommentCount }) => {
    const count = await getCommentCount(params.postSlug)
    return { count }
  }, {
    params: t.Object({ postSlug: t.String() }),
    detail: { tags: ['Comments'], summary: 'Get comment count for a post' },
  })

  // GET /posts/:postSlug/comments/:commentId/replies - Get replies to a comment
  .get('/:commentId/replies', async ({ params, query, getCommentReplies }) => {
    const pagination = commentPaginationSchema.parse(query)
    const sorting = commentSortingSchema.optional().parse(query.sort)
    return getCommentReplies(params.commentId, pagination, sorting)
  }, {
    params: t.Object({ postSlug: t.String(), commentId: t.String() }),
    detail: { tags: ['Comments'], summary: 'Get replies to a comment' },
  })

  // DELETE /posts/:postSlug/comments/:commentId - Delete a comment
  .delete('/:commentId', async ({ params, user, deleteComment }) => {
    await deleteComment(params.commentId, user.id)
    return { success: true }
  }, {
    auth: true,
    params: t.Object({ postSlug: t.String(), commentId: t.String() }),
    detail: { tags: ['Comments'], summary: 'Delete a comment' },
  })
