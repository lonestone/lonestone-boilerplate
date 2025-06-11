import { betterAuth, BetterAuthOptions, MiddlewareInputContext, MiddlewareOptions, User } from 'better-auth'
import { customSession, openAPI } from 'better-auth/plugins'
import { Pool } from 'pg'

interface BetterAuthOptionsDynamic {
  secret: string
  trustedOrigins: string[]
  connectionStringUrl: string
  sendResetPassword?: (
    data: { user: User, url: string, token: string },
    request: Request | undefined
  ) => Promise<void>
  sendVerificationEmail?: (
    data: { user: User, url: string, token: string },
    request: Request | undefined
  ) => Promise<void>
  beforeHook?: ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>)
  afterHook?: ((inputContext: MiddlewareInputContext<MiddlewareOptions>) => Promise<unknown>)
}

// We should use this, but sadly we do not have our custom fields in the session object (only the plugin added fields)
// https://github.com/better-auth/better-auth/issues/2818
// export type BetterAuthSession = ReturnType<typeof createAuth>['$Infer']['Session']

// My workaround to get the session type
export type BetterAuthSession = Awaited<ReturnType<ReturnType<typeof createBetterAuth>['api']['getSession']>>
export type LoggedInBetterAuthSession = NonNullable<BetterAuthSession>

export type BetterAuthType = ReturnType<typeof createBetterAuth>

export function createBetterAuth(options: BetterAuthOptionsDynamic) {
  const authOptions = {
    secret: options.secret,
    trustedOrigins: options.trustedOrigins,
    emailAndPassword: {
      enabled: true,
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
    database: new Pool({
      connectionString: options.connectionStringUrl,
    }),
    advanced: {
      generateId: false,
    },
    rateLimit: {
      window: 50,
      max: 100,
    },
    hooks: {
      before: options?.beforeHook,
      after: options?.afterHook,
    },
    plugins: [
      /* Add plugins here, for example :
      organization({
        allowUserToCreateOrganization: async (_) => {
          return false
        },
      }),
      */
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
      customSession(async ({ user, session }) => {
        /* Here you can add more custom logic to customise the session response */

        /* Example :
        // const organizationInfo = await options?.getOrganizationInfo?.(user.id)
        // return {
        //   user: { ...user, test: true },
        //   session: {
        //     ...session,
        //     activeOrganizationId: organizationInfo?.organizationId,
        //     isHubspotAuthActive: organizationInfo?.isHubspotAuthActive,
        //   },
        // } */

        return {
          user,
          session,
        }
      }, authOptions),
    ],
  })
}
