import type { MikroORM } from '@mikro-orm/core'
import type { BetterAuthOptions, User } from 'better-auth'
import type { BetterAuthType } from './auth.client-types'
import { betterAuth } from 'better-auth'
import { openAPI, organization } from 'better-auth/plugins'
import { mikroOrmAdapter } from './auth-db.adapter'

type BetterAuthHooks = NonNullable<BetterAuthOptions['hooks']>

interface BetterAuthOptionsDynamic {
  orm: MikroORM
  secret: string
  trustedOrigins: string[]
  sendResetPassword?: (
    data: { user: User; url: string; token: string },
    request: Request | undefined,
  ) => Promise<void>
  sendVerificationEmail?: (
    data: { user: User; url: string; token: string },
    request: Request | undefined,
  ) => Promise<void>
  sendInvitationEmail?: (data: {
    email: string
    invitation: { id: string }
    organization: { name: string; id: string }
    inviter: { user: { name: string; email: string } }
  }) => Promise<void>
  beforeHook?: BetterAuthHooks['before']
  afterHook?: BetterAuthHooks['after']
  databaseHooks?: BetterAuthOptions['databaseHooks']
  baseUrl: string
}

export type BetterAuthSession = Awaited<
  ReturnType<ReturnType<typeof createBetterAuth>['api']['getSession']>
>
export type LoggedInBetterAuthSession = NonNullable<BetterAuthSession>

export type { BetterAuthType }

export type BetterAuthContext = ReturnType<typeof createBetterAuth>['$context']

export function createBetterAuth(options: BetterAuthOptionsDynamic): BetterAuthType {
  const authOptions = {
    baseURL: options.baseUrl,
    secret: options.secret,
    trustedOrigins: options.trustedOrigins,
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      sendResetPassword: async (data, request) => {
        if (!options?.sendResetPassword) return
        return options?.sendResetPassword?.(data, request)
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      expiresIn: 60 * 60 * 24 * 10,
      sendVerificationEmail: async (data, request) => {
        if (!options?.sendVerificationEmail) return
        return options?.sendVerificationEmail?.(data, request)
      },
    },
    user: {
      additionalFields: {
        firstName: {
          type: 'string',
          required: false,
          input: true,
        },
        lastName: {
          type: 'string',
          required: false,
          input: true,
        },
        phone: {
          type: 'string',
          required: false,
          input: true,
        },
      },
    },
    database: mikroOrmAdapter(options.orm),
    databaseHooks: options.databaseHooks,
    advanced: {
      database: {
        generateId: false,
      },
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
      openAPI(),
      organization({
        allowUserToCreateOrganization: true,
        creatorRole: 'owner',
        membershipLimit: 500,
        invitationExpiresIn: 60 * 60 * 24 * 7,
        requireEmailVerificationOnInvitation: true,
        async sendInvitationEmail(data) {
          if (options.sendInvitationEmail) {
            await options.sendInvitationEmail(data)
          }
        },
      }),
    ],
  } satisfies BetterAuthOptions

  return betterAuth({
    ...authOptions,
    plugins: [...(authOptions.plugins ?? [])],
  })
}
