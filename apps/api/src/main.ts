import { cors } from '@elysiajs/cors'
import { openapi } from '@elysiajs/openapi'
import { swagger } from '@elysiajs/swagger'
import { Elysia } from 'elysia'
import { appModule } from './app.module'
import { config } from './config/env.config'

export const app = new Elysia()
  .use(cors({
    origin: config.betterAuth.trustedOrigins,
    credentials: true,
  }))
  .use(openapi())
  .use(swagger({
    documentation: {
      info: {
        title: 'Lonestone API',
        version: config.version,
        description: 'The Lonestone API',
      },
      tags: [
        { name: 'Admin Posts', description: 'Admin post management' },
        { name: 'Public Posts', description: 'Public post endpoints' },
        { name: 'Comments', description: 'Comment management' },
        { name: 'Auth', description: 'Authentication endpoints' },
      ],
    },
    path: '/api/docs',
  }))
  .group('/api', app => app
    .use(appModule)
    .get('/health', () => ({
      status: 'ok',
      version: config.version,
      timestamp: new Date().toISOString(),

    }), {
      detail: { tags: ['Health'], summary: 'Health check endpoint' },
    }))
  .listen(config.api.port)

// eslint-disable-next-line no-console
console.log(`🦊 Elysia server running at http://localhost:${config.api.port}`)
// eslint-disable-next-line no-console
console.log(`📚 API docs available at http://localhost:${config.api.port}/api/docs`)

export type App = typeof app
