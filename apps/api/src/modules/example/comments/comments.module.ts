import { Elysia } from 'elysia'
import { commentsRoutes } from './comments.routes'
import { CommentsService } from './comments.service'

export const commentsModule = new Elysia({ name: 'comments' })
  .use(CommentsService)
  .use(commentsRoutes)
