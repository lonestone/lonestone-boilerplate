import type { Auth, BetterAuthOptions } from 'better-auth'

export interface BetterAuthType {
  $context: Promise<object>
  api: {
    getSession: (input: { headers: Headers }) => Promise<{
      session: object
      user: {
        id: string
      }
    } | null>
  }
  handler: Auth['handler']
  options: BetterAuthOptions
}
