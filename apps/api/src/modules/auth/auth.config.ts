import { betterAuth, BetterAuthOptions, User } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { openAPI } from 'better-auth/plugins'
import { Database, dbSchema } from '../db/db.module'

interface BetterAuthOptionsDynamic {
  secret: string
  trustedOrigins: string[]
  sendResetPassword?: (
    data: { user: User, url: string, token: string },
    request: Request | undefined,
  ) => Promise<void>
  sendVerificationEmail?: (
    data: { user: User, url: string, token: string },
    request: Request | undefined,
  ) => Promise<void>
  baseUrl: string
  db: Database
}

// We should use this, but sadly we do not have our custom fields in the session object (only the plugin added fields)
// https://github.com/better-auth/better-auth/issues/2818
// export type BetterAuthSession = ReturnType<typeof createAuth>['$Infer']['Session']

// My workaround to get the session type
export type BetterAuthSession = Awaited<ReturnType<ReturnType<typeof createBetterAuth>['api']['getSession']>>
export type LoggedInBetterAuthSession = NonNullable<BetterAuthSession>

export type BetterAuthType = ReturnType<typeof createBetterAuth>

export interface AuthService {
  api: BetterAuthType['api']
  instance?: BetterAuthType
}

/**
 * The context type for BetterAuth middleware.
 * This type is derived from the first parameter of the $context method of BetterAuthType.
 */
export type BetterAuthContext = ReturnType<typeof createBetterAuth>['$context']

export function createBetterAuth(options: BetterAuthOptionsDynamic) {
  const authOptions = {
    baseURL: options.baseUrl,
    secret: options.secret,
    trustedOrigins: options.trustedOrigins,
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      sendResetPassword: async (data, request) => {
        if (!options?.sendResetPassword)
          return
        return options?.sendResetPassword?.(data, request)
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      expiresIn: 60 * 60 * 24 * 10, // 10 days
      sendVerificationEmail: async (data, request) => {
        if (!options?.sendVerificationEmail)
          return
        return options?.sendVerificationEmail?.(data, request)
      },
    },
    database: drizzleAdapter(options.db, {
      provider: 'pg',
      schema: dbSchema,
    }),
    advanced: {
      database: {
        generateId: false,
      },
    },
    rateLimit: {
      window: 50,
      max: 100,
    },
    plugins: [
      openAPI(),
    ],

  } satisfies BetterAuthOptions

  // We need to pass the options to the customSession plugin to infer the type correctly
  // If you don't do this, you will not have the properties added by plugins (ex. session.activeOrganizationId for the organization plugin)
  // See https://www.better-auth.com/docs/concepts/session-management#customizing-session-response
  return betterAuth({
    ...authOptions,
    plugins: [
      ...(authOptions.plugins ?? []),
    ],

  })
}
