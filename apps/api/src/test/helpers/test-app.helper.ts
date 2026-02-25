import type { AuthService } from 'src/modules/auth/auth.config'
import type { Database } from 'src/modules/db/db.module'
import { Elysia } from 'elysia'
import { createMockAuthService } from './test-auth.helper'

/** Overrides the production dbModule (name: 'db') with a test-specific DB instance. */
export function createTestDbModule(db: Database) {
  return new Elysia({ name: 'db' }).decorate('db', db)
}

/** Overrides the production authModule (name: 'auth') with a mock auth service. */
export function createTestAuthModule() {
  const mockAuth = createMockAuthService()
  const authService: AuthService = { api: mockAuth.api as AuthService['api'] }
  return {
    /** Stub plugin (name: 'auth') so real authModule is skipped; pass authService to compose. */
    plugin: new Elysia({ name: 'auth' }),
    authService,
    setSession: mockAuth.setSession,
    clearSession: mockAuth.clearSession,
  }
}
