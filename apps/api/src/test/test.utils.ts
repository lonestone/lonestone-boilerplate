// TEST UTILS
//
// All test data creation must use factories in src/test/factories/ as per CURSOR_TEST_IMPROVEMENT_PROMPT.md.
// These helpers are for app setup/teardown and request helpers only.
// Arrange-Act-Assert pattern should be followed in all test files.

import { ZodSerializationExceptionFilter, ZodValidationExceptionFilter } from '@lonestone/nzoth/server'
import { MikroORM } from '@mikro-orm/core'
import { MikroOrmModule } from '@mikro-orm/nestjs'
import { INestApplication, ModuleMetadata } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { json } from 'express'
import * as express from 'express'
import supertest, { Response } from 'supertest'
import { AuthModule } from '../modules/auth/auth.module'
import { createTestContainer } from './test-container.helper'

// ============================================================
// HTTP Request helpers
// ============================================================

/**
 * Creates a request helper for making HTTP requests to the test app.
 * No authentication headers needed - auth is mocked at the AuthService level.
 *
 * @param app The NestJS application instance
 * @returns Object with get, post, patch, del methods
 */
export function createRequest(app: INestApplication) {
  const server = app.getHttpServer()
  return {
    get: (url: string) => supertest(server).get(url),
    post: (url: string) => supertest(server).post(url),
    patch: (url: string) => supertest(server).patch(url),
    put: (url: string) => supertest(server).put(url),
    del: (url: string) => supertest(server).delete(url),
  }
}

export type TestRequest = ReturnType<typeof createRequest>

// ============================================================
// Test App Context
// ============================================================

export interface TestAppContext {
  app: INestApplication
  orm: MikroORM
  moduleFixture: TestingModule
  container: StartedPostgreSqlContainer
}

interface InitializeOptions {
  includeAuthModule?: boolean
}

/**
 * Initializes a NestJS application with a new test container.
 *
 * @param metadata The metadata for the test module
 * @returns An object containing the app, ORM, module fixture, container context
 */
export async function initializeTestApp(
  metadata: ModuleMetadata & InitializeOptions,
): Promise<TestAppContext> {
  try {
    // Create a new container for this test
    const containerContext = await createTestContainer()

    const moduleBuilder = Test.createTestingModule({
      imports: [
        MikroOrmModule.forRoot(containerContext.mikroOrmOptions),
        ...(metadata.includeAuthModule === false ? [] : [AuthModule]),
        ...(metadata.imports ?? []),
      ],
      controllers: [...(metadata.controllers ?? [])],
    })

    if (metadata.providers) {
      for (const provider of metadata.providers) {
        if (provider && typeof provider === 'object' && 'provide' in provider && 'useValue' in provider) {
          moduleBuilder.overrideProvider(provider.provide).useValue(provider.useValue)
        }
      }
    }

    const moduleFixture = await moduleBuilder.compile()

    // Create the application
    const app = moduleFixture.createNestApplication({
      bodyParser: false,
    })

    // Add global filters for Zod error handling (as in main.ts)
    app.useGlobalFilters(
      new ZodValidationExceptionFilter(),
      new ZodSerializationExceptionFilter(),
    )

    // Configure the app as in main.ts
    app.use(json({ limit: '50mb' }))
    app.use(
      (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
      ) => {
        // If it's a better auth route, call next()
        if (req.originalUrl.startsWith(`auth`)) {
          return next()
        }
        // Otherwise, apply the express json middleware
        express.json()(req, res, next)
      },
    )
    app.enableCors({
      origin: '*',
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true,
    })

    await app.init()

    return { app, orm: containerContext.orm, moduleFixture, container: containerContext.container }
  }
  catch (error) {
    console.error('Error during test app initialization:', error)
    throw error
  }
}

// ============================================================
// SSE Request helpers (for streaming endpoints)
// ============================================================

interface SSECallbacks {
  onInit?: (req: supertest.Request, res: Response) => void
  onData?: (data: string) => void
}

interface SSERequest {
  method: 'get'
  url: string
  callbacks: SSECallbacks
  expectedEvents: number
  timeout: number
  done: () => void
}

export function createSSERequest(app: INestApplication) {
  return (options: SSERequest) => {
    return new Promise<boolean>((resolve, reject) => {
      const req = supertest(app.getHttpServer())[options.method](options.url)
      req
        .set('Accept', 'text/event-stream')
        .buffer(false)
        .parse((res: Response, callback) => {
          options.callbacks.onInit?.(req, res)
          res.setEncoding('utf8')
          let buffer = ''
          let count = 0

          res.on('data', (chunk) => {
            buffer += chunk
            const match = buffer.match(/data: (.+)/)
            if (match) {
              const rawData = match[1]
              buffer = '' // reset buffer after parsing

              options.callbacks.onData?.(rawData)
              count++

              if (count >= options.expectedEvents) {
                callback(null, {})
                resolve(true)
                options.done()
              }
            }
          })

          res.on('error', (err) => {
            callback(err, {})
            reject(err)
          })
        })
        .timeout({ response: options.timeout, deadline: options.timeout })
        .end((err) => {
          if (err)
            reject(err)
          options.done()
        })
    })
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
    await context.orm.close(true)
    await context.container.stop()
  }
  catch (error) {
    console.error('Error during test app cleanup:', error)
    // Continue cleanup even if there are errors
  }
}
