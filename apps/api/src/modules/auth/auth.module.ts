import { Global, Inject, Module, RequestMethod } from "@nestjs/common";
import {
  DiscoveryModule,
  DiscoveryService,
  MetadataScanner,
} from "@nestjs/core";
import type {
  MiddlewareConsumer,
  NestModule,
} from "@nestjs/common";
import type {
  Auth,
  MiddlewareOptions,
  MiddlewareContext,
  AuthContext,
} from "better-auth";
import { createAuthMiddleware } from "better-auth/plugins";
import { toNodeHandler } from "better-auth/node";
import { AuthService } from "./auth.service";
import { BEFORE_HOOK_KEY, AFTER_HOOK_KEY, HOOK_KEY } from "./auth.decorator";
import { EmailModule } from "../email/email.module";

@Global()
@Module({
  imports: [
    DiscoveryModule,
    EmailModule,
  ],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule implements NestModule {
  constructor(
    private readonly authService: AuthService,
    @Inject(DiscoveryService)
    private discoveryService: DiscoveryService,
    @Inject(MetadataScanner)
    private metadataScanner: MetadataScanner
  ) {}

  configure(consumer: MiddlewareConsumer) {
    if (!this.authService.auth.options.hooks) return;

    const providers = this.discoveryService
      .getProviders()
      .filter(
        ({ metatype }) => metatype && Reflect.getMetadata(HOOK_KEY, metatype)
      );

    for (const provider of providers) {
      const providerPrototype = Object.getPrototypeOf(provider.instance);
      const methods = this.metadataScanner.getAllMethodNames(providerPrototype);

      for (const method of methods) {
        const providerMethod = providerPrototype[method];

        this.setupHook(BEFORE_HOOK_KEY, "before", providerMethod);
        this.setupHook(AFTER_HOOK_KEY, "after", providerMethod);
      }
    }

    const handler = toNodeHandler(this.authService.auth);
    
    consumer.apply(handler).forRoutes({
      path: "/auth/*",
      method: RequestMethod.ALL,
    });
  }

  private setupHook(
    metadataKey: symbol,
    hookType: "before" | "after",
    providerMethod: (
      ctx: MiddlewareContext<
        MiddlewareOptions,
        AuthContext & {
          returned?: unknown;
          responseHeaders?: Headers;
        }
      >
    ) => Promise<void>
  ) {
    const hookPath = Reflect.getMetadata(metadataKey, providerMethod);
    if (!hookPath || !this.authService.auth.options.hooks) return;

    const originalHook = this.authService.auth.options.hooks[hookType];
    this.authService.auth.options.hooks[hookType] = createAuthMiddleware(
      async (ctx) => {
        if (originalHook) {
          await originalHook(ctx);
        }

        if (hookPath === ctx.path) {
          await providerMethod(ctx);
        }
      }
    );
  }


  static forRootAsync() {
    return {
      module: AuthModule,
      imports: [],
      providers: [
        {
          provide: "AUTH_OPTIONS",
          useFactory: async () => {},
          inject: [],
        },
        AuthService,
      ],
      exports: [AuthService, "AUTH_OPTIONS"],
    };
  }
}
