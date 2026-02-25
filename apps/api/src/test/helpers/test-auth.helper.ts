import type { BetterAuthSession } from '../../modules/auth/auth.config'
import { AsyncLocalStorage } from 'node:async_hooks'
import { randomBytes } from 'node:crypto'
import { Elysia } from 'elysia'
import { User } from '../../modules/db/schemas/auth.schema'

/** Session scoped to the current request (enables parallel tests). Fallback: global _session when no header. */
export const testSessionStorage = new AsyncLocalStorage<BetterAuthSession>()

/** Store sessions by short id to avoid "Request Header Fields Too Large" (431) when passing large sessions. */
const testSessionStore = new Map<string, BetterAuthSession>()

/** Clears the test session store. Call in beforeEach/afterEach of e2e specs to avoid accumulation. */
export function clearTestSessionStore(): void {
  testSessionStore.clear()
}

/** Minimal auth API shape for tests; cast to AuthService['api'] at app composition. */
export interface MockAuthService {
  api: {
    getSession: (opts: { headers: Headers }) => Promise<BetterAuthSession | null>
  }
  setSession: (session: NonNullable<BetterAuthSession>) => void
  clearSession: () => void
}

/**
 * Creates a mock AuthService for e2e tests.
 */
export function createMockAuthService(): MockAuthService {
  let _session: BetterAuthSession = null

  return {
    api: {
      getSession: async (opts: { headers: Headers }): Promise<BetterAuthSession | null> => {
        const id = opts.headers.get('x-test-session-id')
        if (id) {
          const fromStore = getTestSession(id)
          if (fromStore)
            return fromStore
        }
        return testSessionStorage.getStore() ?? _session
      },
    },
    setSession(session: NonNullable<BetterAuthSession>) {
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

/** Elysia plugin: when X-Test-Session-Id is present, runs the request in testSessionStorage so getSession() returns it. */
export const testSessionPlugin = new Elysia({ name: 'test-session' })
  .onBeforeHandle(({ request }) => {
    const id = request.headers.get('x-test-session-id')
    const session = id ? getTestSession(id) : null
    if (session) {
      // Note: AsyncLocalStorage.run returns the result of the callback
      // But in Elysia middleware, we want to continue the execution
      // This is a bit tricky with AsyncLocalStorage in Elysia
    }
  })
  .derive(({ request }) => {
    const id = request.headers.get('x-test-session-id')
    const session = id ? getTestSession(id) : null
    return { testSession: session }
  })

// ============================================================
// Session creation helpers
// ============================================================

/**
 * Creates a BetterAuthSession from a User entity.
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
 */
export function createRequest(app: { handle: (request: Request) => Promise<Response> }) {
  const baseUrl = 'http://localhost'

  async function makeRequest(
    method: string,
    url: string,
    options?: { body?: unknown, headers?: Record<string, string> },
  ) {
    const response = await app.handle(
      new Request(`${baseUrl}${url}`, {
        method,
        body: options?.body ? JSON.stringify(options.body) : undefined,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      }),
    )

    let body = null
    try {
      body = await response.json()
    }
    catch {
      // Not JSON
    }

    return {
      status: response.status,
      body,
      headers: response.headers,
    }
  }

  const createMethods = (headers: Record<string, string> = {}) => ({
    get: (url: string) => makeRequest('GET', url, { headers }),
    post: (url: string) => ({
      send: (body: unknown) => makeRequest('POST', url, { body, headers }),
    }),
    patch: (url: string) => ({
      send: (body?: unknown) => makeRequest('PATCH', url, { body, headers }),
    }),
    put: (url: string) => ({
      send: (body: unknown) => makeRequest('PUT', url, { body, headers }),
    }),
    del: (url: string) => makeRequest('DELETE', url, { headers }),
  })

  return {
    ...createMethods(),
    withSession(session: BetterAuthSession) {
      const id = putTestSession(session)
      return createMethods({ [TEST_SESSION_ID_HEADER.toLowerCase()]: id })
    },
  }
}

export type TestRequest = ReturnType<typeof createRequest>
