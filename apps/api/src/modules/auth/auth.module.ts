import type {
  MiddlewareConsumer,
  NestModule,
} from '@nestjs/common'
import type {
  AuthContext,
  MiddlewareContext,
  MiddlewareOptions,
} from 'better-auth'
import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Global, Inject, Module, RequestMethod } from '@nestjs/common'
import {
  DiscoveryModule,
  DiscoveryService,
  MetadataScanner,
} from '@nestjs/core'
import { toNodeHandler } from 'better-auth/node'
import { createAuthMiddleware } from 'better-auth/plugins'
import { createBetterAuth } from '../../config/better-auth.config'
import { config } from '../../config/env.config'
import { EmailModule } from '../email/email.module'
import { EmailService } from '../email/email.service'
import { AFTER_HOOK_KEY, BEFORE_HOOK_KEY, HOOK_KEY } from './auth.decorator'
import { AuthModuleOptions, ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } from './auth.definition'
import { Account, Session, User, Verification } from './auth.entity'
import { AuthGuard } from './auth.guard'
import { AuthService } from './auth.service'

@Global()
@Module({
  imports: [
    DiscoveryModule,
    EmailModule,
    MikroOrmModule.forFeature([User, Session, Account, Verification]),
  ],
  providers: [
    {
      provide: MODULE_OPTIONS_TOKEN,
      useFactory: (emailService: EmailService): AuthModuleOptions => {
        const betterAuth = createBetterAuth({
          baseUrl: config.api.baseUrl,
          secret: config.betterAuth.secret,
          trustedOrigins: config.betterAuth.trustedOrigins,
          connectionStringUrl: config.database.connectionStringUrl,
          sendResetPassword: async (data) => {
            const webUrl = `${config.clients.webApp.url}/reset-password?token=${data.token}`
            return emailService.sendEmail({
              to: data.user.email,
              subject: 'Reset your password',
              content: `Hello ${data.user.name}, please reset your password with the link below:<br/>Web app: <a href="${webUrl}">${webUrl}</a>`,
            })
          },
          sendVerificationEmail: async (data) => {
            const url = `${config.clients.webApp.url}/verify-email?token=${data.token}`
            return emailService.sendEmail({
              to: data.user.email,
              subject: 'Verify your email',
              content: `Hello ${data.user.name}, please verify your email by clicking on the link below: <a href="${url}">${url}</a>`,
            })
          },
        })
        return {
          auth: betterAuth,
        }
      },
      inject: [EmailService],
    },
    AuthService,
    AuthGuard,
  ],
  exports: [
    AuthService,
    AuthGuard,
  ],
})
export class AuthModule extends ConfigurableModuleClass implements NestModule {
  constructor(
    @Inject(DiscoveryService)
    private readonly discoveryService: DiscoveryService,
    @Inject(MetadataScanner)
    private readonly metadataScanner: MetadataScanner,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
  ) {
    super()
  }

  configure(consumer: MiddlewareConsumer) {
    const auth = this.options.auth

    const providers = this.discoveryService
      .getProviders()
      .filter(
        ({ metatype, instance }) =>
          metatype
          && instance
          && Reflect.getMetadata(HOOK_KEY, metatype),
      )

    for (const provider of providers) {
      const providerPrototype = Object.getPrototypeOf(provider.instance!)
      const methods = this.metadataScanner.getAllMethodNames(providerPrototype)

      for (const method of methods) {
        const providerMethod = providerPrototype[method]

        this.setupHook(BEFORE_HOOK_KEY, 'before', providerMethod, provider.instance)
        this.setupHook(AFTER_HOOK_KEY, 'after', providerMethod, provider.instance)
      }
    }

    const handler = toNodeHandler(auth)

    consumer.apply(handler).forRoutes({
      path: '/auth/*',
      method: RequestMethod.ALL,
    })
  }

  private setupHook(
    metadataKey: symbol,
    hookType: 'before' | 'after',
    providerMethod: (
      ctx: MiddlewareContext<
        MiddlewareOptions,
        AuthContext & {
          returned?: unknown
          responseHeaders?: Headers
        }
      >,
    ) => Promise<void>,
    providerInstance: unknown,
  ) {
    const auth = this.options.auth
    const hookPath = Reflect.getMetadata(metadataKey, providerMethod)
    if (!hookPath || !auth?.options.hooks)
      return

    const originalHook = auth.options.hooks[hookType]
    auth.options.hooks[hookType] = createAuthMiddleware(
      async (ctx) => {
        if (originalHook) {
          await originalHook(ctx)
        }

        if (hookPath === ctx.path) {
          await providerMethod.call(providerInstance, ctx)
        }
      },
    )
  }
}
