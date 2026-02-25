import type { BetterAuthSession, LoggedInBetterAuthSession } from './auth.config'
import { Elysia } from 'elysia'
import { authModule } from './auth.module'

export const AuthMacro = new Elysia({ name: 'auth-macro' })
  .use(authModule)
  .macro({
    auth: {
      async resolve({ status, request: { headers }, authService }) {
        const session = await authService.api.getSession({
          headers,
        })

        if (!session)
          return status(401)

        return {
          user: session.user,
          session: session.session,
        }
      },
    },
  })

// Type guard for authenticated routes
export function assertSession(session: BetterAuthSession): asserts session is LoggedInBetterAuthSession {
  if (!session) {
    throw new Error('Session is required')
  }
}
