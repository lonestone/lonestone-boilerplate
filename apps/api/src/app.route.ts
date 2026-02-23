import Elysia from 'elysia'
import { aiExampleRoutes } from './modules/example/ai-example/ai-example.routes'
import { postRoutes, publicPostRoutes } from './modules/example/posts/posts.routes'

const appRoutes = new Elysia()
  .get('/', () => 'Hello World')
  .use(postRoutes)
  .use(publicPostRoutes)
  .use(aiExampleRoutes)

export default appRoutes
