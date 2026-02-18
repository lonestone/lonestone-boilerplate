// TEST UTILS
//
// All test data creation must use factories in src/test/factories/ as per CURSOR_TEST_IMPROVEMENT_PROMPT.md.
// These helpers are for app setup/teardown and request helpers only.
// Arrange-Act-Assert pattern should be followed in all test files.

import { ZodSerializationExceptionFilter, ZodValidationExceptionFilter } from '@lonestone/nzoth/server'
import { MikroORM } from '@mikro-orm/core'
import { MikroOrmModule } from '@mikro-orm/nestjs'
import { INestApplication, ModuleMetadata } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import * as express from 'express'
import { BetterAuthSession } from '../../config/better-auth.config'
import { AuthModule } from '../../modules/auth/auth.module'
import { AuthService } from '../../modules/auth/auth.service'
import { createMockAuthService, testSessionMiddleware } from './test-auth.helper'

// ============================================================
// Test App Context
// ============================================================

export interface TestAppContext {
  app: INestApplication
  orm: MikroORM
  /** AuthService instance with mocked getSession/setSession - use setSession() to configure auth per test */
  setSession: (session: BetterAuthSession) => void
  clearSession: () => void
}

interface InitializeTestAppOptions {
  orm: MikroORM
}

/**
 * Initializes a NestJS application with a new test container.
 * AuthService is mocked in test.e2e-setup (vi.mock) with getSession/setSession only.
 *
 * @param options The options for the test application
 * @returns An object containing the app, ORM, and setSession/clearSession functions
 */
export async function initializeTestApp(options: InitializeTestAppOptions, metadata: ModuleMetadata): Promise<TestAppContext> {
  try {
    // Use test ORM config (entities as classes) to avoid require() on .ts paths → SyntaxError.
    // One DB per test (isolation): config comes from test-db.helper (contextName there is for the test ORM only).
    // Nest uses contextName: undefined so MikroOrmModule registers the default EntityManager token (UserService/repos inject EntityManager); named tokens are only for multi-connection apps.
    const testOrmOptions = {
      ...options.orm.config.getAll(),
      contextName: undefined,
      pool: {
        min: 0,
        max: 1,
      },
    }
    const mikroOrmModule = await MikroOrmModule.forRoot(testOrmOptions)
    const moduleBuilder = Test.createTestingModule({
      imports: [
        mikroOrmModule,
        AuthModule,
        ...(metadata.imports ?? []),
      ],
      controllers: [...(metadata.controllers ?? [])],
    })

    const mockAuthService = createMockAuthService()
    moduleBuilder.overrideProvider(AuthService).useValue(mockAuthService)

    if (metadata.providers) {
      for (const provider of metadata.providers) {
        if (provider && typeof provider === 'object' && 'provide' in provider && 'useValue' in provider) {
          moduleBuilder.overrideProvider(provider.provide).useValue(provider.useValue)
        }
      }
    }

    const moduleFixture = await moduleBuilder.compile()

    const { setSession, clearSession } = mockAuthService

    // Create the application
    const app = moduleFixture.createNestApplication({
      bodyParser: false,
    })

    // Add global filters for Zod error handling (as in main.ts)
    app.useGlobalFilters(
      new ZodValidationExceptionFilter(),
      new ZodSerializationExceptionFilter(),
    )

    app.use(testSessionMiddleware)

    // Configure body parsing as in main.ts:
    // - Skip JSON parsing for Better Auth routes (needs raw body)
    // - Parse JSON for everything else
    app.use(
      (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
      ) => {
        if (req.originalUrl.startsWith('/auth')) {
          return next()
        }
        express.json({ limit: '50mb' })(req, res, next)
      },
    )
    app.enableCors({
      origin: '*',
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true,
    })

    await app.init()

    return {
      orm: options.orm,
      app,
      setSession,
      clearSession,
    }
  }
  catch (error) {
    console.error('Error during test app initialization:', error)
    throw error
  }
}
// ============================================================
// Cleanup helpers
// ============================================================

/**
 * Closes the app and ORM, and cleans up the test container
 * @param context The test app context
 */
export async function closeTestApp(context: TestAppContext): Promise<void> {
  if (!context) {
    console.warn('closeTestApp called with null context')
    return
  }

  try {
    await context.app.close()
  }
  catch (error: unknown) {
    // Ignore "Connection is closed" errors from Redis as they're expected during cleanup
    // This happens when BullMQ closes Redis connections during app.close()
    if (error instanceof Error && error.message.includes('Connection is closed')) {
      return
    }
    console.error('Error during test app cleanup:', error)
    // Continue cleanup even if there are errors
  }
}
