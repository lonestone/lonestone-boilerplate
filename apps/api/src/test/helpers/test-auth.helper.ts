import { AsyncLocalStorage } from 'node:async_hooks'
import { randomBytes } from 'node:crypto'
import { INestApplication } from '@nestjs/common'
import { NextFunction, Request, Response } from 'express'
import { BetterAuthSession } from 'src/config/better-auth.config'
import supertest from 'supertest'
import { User } from '../../modules/auth/auth.entity'

/** Session scoped to the current request (enables parallel tests). Fallback: global _session when no header. */
export const testSessionStorage = new AsyncLocalStorage<BetterAuthSession>()

/** Store sessions by short id to avoid "Request Header Fields Too Large" (431) when passing large sessions. */
const testSessionStore = new Map<string, BetterAuthSession>()

/** Clears the test session store. Call in beforeEach/afterEach of e2e specs to avoid accumulation. */
export function clearTestSessionStore(): void {
  testSessionStore.clear()
}

export interface MockAuthService {
  api: { getSession: () => Promise<BetterAuthSession | null> }
  setSession: (session: BetterAuthSession) => void
  clearSession: () => void
}

/**
 * Creates a mock AuthService for e2e tests.
 * Uses useValue (not useClass) so it does not depend on MODULE_OPTIONS_TOKEN injection.
 */
export function createMockAuthService(): MockAuthService {
  let _session: BetterAuthSession = null

  return {
    api: {
      getSession: async () => testSessionStorage.getStore() ?? _session,
    },
    setSession(session: BetterAuthSession) {
      _session = session
    },
    clearSession() {
      _session = null
    },
  }
}

const TEST_SESSION_ID_HEADER = 'X-Test-Session-Id'

function putTestSession(session: BetterAuthSession): string {
  const id = randomBytes(8).toString('hex')
  testSessionStore.set(id, session)
  return id
}

export function getTestSession(id: string): BetterAuthSession | null {
  return testSessionStore.get(id) ?? null
}

/** Express middleware: when X-Test-Session-Id is present, runs the request in testSessionStorage so getSession() returns it. Register in test app with app.use(testSessionMiddleware). */
export function testSessionMiddleware(req: Request, res: Response, next: NextFunction): void {
  const id = req.headers['x-test-session-id'] as string | undefined
  const session = id ? getTestSession(id) : null
  if (session) {
    testSessionStorage.run(session, () => next())
  }
  else {
    next()
  }
}

// ============================================================
// Session creation helpers
// ============================================================

/**
 * Creates a BetterAuthSession from a User entity.
 * Use this to create a mock session for authenticated requests.
 *
 * @param user The user entity to create a session for
 * @returns A BetterAuthSession object
 */
export function createSessionFromUser(user: User): BetterAuthSession {
  return {
    session: {
      id: `test-session-${user.id}`,
      token: `test-token-${user.id}`,
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h from now
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: '127.0.0.1',
    },
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      image: user.image ?? null,
    },
  } as BetterAuthSession
}

// ============================================================
// HTTP Request helpers
// ============================================================

/**
 * Creates a request helper for making HTTP requests to the test app.
 * Use withSession(session) for per-request auth so tests can run in parallel without sharing session state.
 *
 * @param app The NestJS application instance
 * @returns Object with get, post, patch, put, del and withSession(session) for request-scoped auth
 */
export function createRequest(app: INestApplication) {
  const server = app.getHttpServer()
  const noAuth = {
    get: (url: string) => supertest(server).get(url),
    post: (url: string) => supertest(server).post(url),
    patch: (url: string) => supertest(server).patch(url),
    put: (url: string) => supertest(server).put(url),
    del: (url: string) => supertest(server).delete(url),
  }
  return {
    ...noAuth,
    /** Request-scoped session: safe for parallel tests. Session stored by id to avoid 431 header size limit. */
    withSession(session: BetterAuthSession) {
      const id = putTestSession(session)
      const h = { [TEST_SESSION_ID_HEADER]: id }
      return {
        get: (url: string) => supertest(server).get(url).set(h),
        post: (url: string) => supertest(server).post(url).set(h),
        patch: (url: string) => supertest(server).patch(url).set(h),
        put: (url: string) => supertest(server).put(url).set(h),
        del: (url: string) => supertest(server).delete(url).set(h),
      }
    },
  }
}

export type TestRequest = ReturnType<typeof createRequest>
