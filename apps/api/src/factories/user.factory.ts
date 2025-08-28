import { EntityManager } from '@mikro-orm/core'
import { hashPassword } from 'better-auth/crypto'
import { Account, User } from '../modules/auth/auth.entity'

/**
 * Creates a test user
 * @param em The EntityManager instance
 * @param overrides Options to customize the user
 * @returns The created user
 */
export async function createUserData(em: EntityManager, overrides?: Partial<User>, password?: string): Promise<User> {
  const user = em.create(User, {
    name: overrides?.name ?? 'Test User',
    email: overrides?.email ?? `test-${Math.random().toString(36).substring(2, 8)}@lonestone.com`,
    emailVerified: overrides?.emailVerified ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })
  await em.persistAndFlush(user)

  const account = new Account()
  account.user = user
  account.providerId = 'credential'
  account.accountId = crypto.randomUUID()
  // Store the password directly
  account.password = await hashPassword(password ?? 'Password123!')
  await em.persistAndFlush(account)

  return user
}
