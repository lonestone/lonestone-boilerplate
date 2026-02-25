import { Elysia } from 'elysia'
import appRoutes from './app.route'
import { aiModule } from './modules/ai/ai.module'
import { authModule } from './modules/auth/auth.module'
import { dbModule } from './modules/db/db.module'
import { emailModule } from './modules/email/email.module'
import { commentsModule } from './modules/example/comments/comments.module'
import { postsModule } from './modules/example/posts/posts.module'

export const appModule = new Elysia({ name: 'app' })
  .use(dbModule)
  .use(emailModule)
  .use(aiModule)
  .use(authModule)
  .use(appRoutes)
  .use(postsModule)
  .use(commentsModule)
