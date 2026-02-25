import { Elysia } from 'elysia'
import { config } from '../../config/env.config'
import { dbModule } from '../db/db.module'
import { createBetterAuth } from './auth.config'

export const authModule = new Elysia({ name: 'auth' })
  .use(dbModule)
  .derive({ as: 'global' }, ({ db }) => {
    const authConfig = createBetterAuth({
      baseUrl: config.api.baseUrl,
      secret: config.betterAuth.secret,
      trustedOrigins: config.betterAuth.trustedOrigins,
      db,
    })
    return {
      authService: {
        api: authConfig.api,
        instance: authConfig,
      },
    }
  })
  .all('/auth/*', async ({ request, authService }) => {
    return authService.instance.handler(request)
  })
