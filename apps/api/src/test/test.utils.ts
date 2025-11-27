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
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { json } from 'express'
import * as express from 'express'
import supertest, { Request, Response } from 'supertest'
import { createTestMikroOrmOptions } from '../config/mikro-orm.config'
import { AuthGuard } from '../modules/auth/auth.guard'
import { AuthModule } from '../modules/auth/auth.module'
import { MOCK_AUTH_TOKEN, MockAuthGuard } from './test-auth-guard.mock'

export const TEST_USER_ID = 'cc8edee2-e4e6-4122-b77f-344247f86ead'
export const TEST_USER_TOKEN = 'test-token'

let postgresContainer: StartedPostgreSqlContainer

export interface TestAppContext {
  app: INestApplication
  orm: MikroORM
  moduleFixture: TestingModule
}

/**
 * Initializes a NestJS application for testing
 * @param metadata The metadata for the test module
 * @returns An object containing the app, ORM, and test module
 */
interface GuardOverride { guard: unknown, useValue: unknown }

interface InitializeOptions {
  overrideGuards?: GuardOverride[]
  includeAuthModule?: boolean
  overrideDefaultAuthGuard?: boolean
}

export async function initializeTestApp(
  metadata: ModuleMetadata & InitializeOptions,
): Promise<TestAppContext> {
  // Initialize DB with test containers
  postgresContainer = await new PostgreSqlContainer('postgres:16-alpine').start()

  const mikroOrmOptions = createTestMikroOrmOptions({
    allowGlobalContext: true,
    dbName: postgresContainer.getDatabase(),
    host: postgresContainer.getHost(),
    port: postgresContainer.getPort(),
    user: postgresContainer.getUsername(),
    password: postgresContainer.getPassword(),
  })

  const orm = await MikroORM.init(mikroOrmOptions)

  await orm.schema.refreshDatabase()

  const moduleBuilder = Test.createTestingModule({
    imports: [
      MikroOrmModule.forRoot(mikroOrmOptions),
      ...(metadata.includeAuthModule === false ? [] : [AuthModule]),
      ...(metadata.imports ?? []),
    ],
    controllers: [...(metadata.controllers ?? [])],
  })
  if (metadata.overrideDefaultAuthGuard !== false) {
    moduleBuilder.overrideGuard(AuthGuard).useClass(MockAuthGuard)
  }

  if (metadata.overrideGuards?.length) {
    for (const override of metadata.overrideGuards) {
      moduleBuilder.overrideGuard(override.guard).useValue(override.useValue)
    }
  }

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

  return { app, orm, moduleFixture }
}

export function initRequestWithAuth(app: INestApplication, userId: string) {
  return (method: 'get' | 'post' | 'put' | 'del' | 'patch', url: string) => {
    let req = supertest(app.getHttpServer())[method](url).set('Authorization', `Bearer ${MOCK_AUTH_TOKEN}`)
    if (userId) {
      req = req.set('x-test-user-id', userId)
    }
    return req
  }
}

interface SSECallbacks {
  onInit?: (req: Request, res: Response) => void
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

export function initRequestWithAuthAndSSE(
  app: INestApplication,
  userId: string,
  organizationId: string,
) {
  return (
    options: SSERequest,
  ) => {
    return new Promise<boolean>((resolve, reject) => {
      let req = supertest(app.getHttpServer())[options.method](options.url).set('Authorization', `Bearer ${MOCK_AUTH_TOKEN}`)
      if (userId) {
        req = req.set('x-test-user-id', userId)
        req = req.set('x-test-organization-id', organizationId)
      }
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

/**
 * Closes the app and ORM, and Bull queues if present
 * @param context The test app context
 */
export async function closeTestApp(context: TestAppContext): Promise<void> {
  await context.app.close()
  await context.orm.close(true)
  await postgresContainer.stop()
}
