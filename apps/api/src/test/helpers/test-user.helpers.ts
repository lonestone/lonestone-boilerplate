// TEST HELPERS
//
// Role-based session helpers to reduce boilerplate in e2e tests.
// Use factories (src/factories/) for entity creation; these helpers combine user + session.

import type { EntityManager } from '@mikro-orm/core'
import type { BetterAuthSession } from '../../config/better-auth.config'
import type { User } from '../../modules/auth/auth.entity'
import { createUserData } from '../../factories/user.factory'
import { createSessionFromUser } from './test-auth.helper'

export interface UserWithSession {
  user: User
  session: BetterAuthSession
}

/**
 * Creates a user and session. Use for tests that need an authenticated user.
 */
export async function createUserWithSession(
  em: EntityManager,
  overrides?: Partial<User>,
): Promise<UserWithSession> {
  const user = await createUserData(em, overrides)
  const session = createSessionFromUser(user)
  return { user, session }
}

// ============================================================
// Role-specific helpers (to extend for projects with roles)
// ============================================================

// Example for projects using Better Auth organizations plugin:
//
// export interface AdminWithSession {
//   user: User
//   organization: Organization
//   membership: OrganizationMember
//   session: BetterAuthSession
// }
//
// export async function createAdminWithSession(
//   em: EntityManager,
//   organization: Organization,
// ): Promise<AdminWithSession> {
//   const user = await createUserData(em)
//   const membership = await addMemberToOrganization(em, organization, user, 'admin')
//   const session = createSessionFromUser(user, { activeOrganizationId: organization.id })
//   return { user, organization, membership, session }
// }

// Example for projects with simple role field:
//
// export async function createSuperadminWithSession(
//   em: EntityManager,
// ): Promise<UserWithSession> {
//   const user = await createUserData(em, { role: 'superadmin' })
//   const session = createSessionFromUser(user)
//   return { user, session }
// }
