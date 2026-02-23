import { Elysia } from 'elysia'
import { postRoutes, publicPostRoutes } from './posts.routes'
import { PostService } from './posts.service'

export const postsModule = new Elysia({ name: 'posts' })
  .use(PostService)
  .use(postRoutes)
  .use(publicPostRoutes)
