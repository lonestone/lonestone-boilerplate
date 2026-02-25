// TEST HELPERS
//
// Role-based session helpers to reduce boilerplate in e2e tests.
// Use factories (src/factories/) for entity creation; these helpers combine user + session.

import type { LoggedInBetterAuthSession } from 'src/modules/auth/auth.config'
import type { Database } from 'src/modules/db/db.module'
import type { User } from 'src/modules/db/schemas/auth.schema'
import { user } from 'src/modules/db/schemas/auth.schema'
import { createSessionFromUser } from './test-auth.helper'

export interface UserWithSession {
  user: User
  session: LoggedInBetterAuthSession
}

/**
 * Creates a user and session. Use for tests that need an authenticated user.
 */
export async function createUserWithSession(
  db: Database,
  overrides?: Partial<User>,
): Promise<UserWithSession> {
  const newUser = await db.insert(user).values({
    name: 'Test User',
    email: 'test@example.com',
    emailVerified: true,
    ...overrides,
  }).returning().then(result => result[0])

  if (!newUser)
    throw new Error('Failed to create user')

  const session = createSessionFromUser(newUser) as LoggedInBetterAuthSession
  return { user: newUser, session }
}
