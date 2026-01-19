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
import { Global, Inject, Module, OnModuleInit, RequestMethod } from '@nestjs/common'
import {
  DiscoveryModule,
  DiscoveryService,
  MetadataScanner,
} from '@nestjs/core'
import { toNodeHandler } from 'better-auth/node'
import { createAuthMiddleware } from 'better-auth/plugins'
import { EmailModule } from '../email/email.module'
import { AFTER_HOOK_KEY, BEFORE_HOOK_KEY, HOOK_KEY } from './auth.decorator'
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
    AuthService,
    AuthGuard,
  ],
  exports: [
    AuthService,
    AuthGuard,
  ],
})
export class AuthModule implements NestModule, OnModuleInit {
  constructor(
    private readonly authService: AuthService,
    @Inject(DiscoveryService)
    private discoveryService: DiscoveryService,
    @Inject(MetadataScanner)
    private metadataScanner: MetadataScanner,
  ) {}

  async onModuleInit() {
    // Ensure auth service is initialized
    await this.authService.onModuleInit()
  }

  async configure(consumer: MiddlewareConsumer) {
    // Wait for auth to be initialized
    await this.onModuleInit()

    const auth = this.authService.auth

    const providers = this.discoveryService
      .getProviders()
      .filter(
        ({ metatype }) => metatype && Reflect.getMetadata(HOOK_KEY, metatype),
      )

    for (const provider of providers) {
      const providerPrototype = Object.getPrototypeOf(provider.instance)
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
    const auth = this.authService.auth
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

  static forRootAsync() {
    return {
      module: AuthModule,
      imports: [EmailModule],
      providers: [
        AuthService,
        {
          provide: 'AUTH_OPTIONS',
          useClass: AuthService,
        },
      ],
      exports: [AuthService, 'AUTH_OPTIONS'],
    }
  }
}
