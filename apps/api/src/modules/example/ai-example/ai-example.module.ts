import { Elysia } from 'elysia'
import { aiExampleRoutes } from './ai-example.routes'

export const aiExampleModule = new Elysia({ name: 'AiExample.Module' })
  .use(aiExampleRoutes)
