import { EntityManager } from '@mikro-orm/core'
import { hashPassword } from 'better-auth/crypto'
import { Account, User } from './auth.entity'

/**
 * Creates a test user
 * @param em The EntityManager instance
 * @param overrides Options to customize the user
 * @returns The created user
 */
export async function createUserData(em: EntityManager, overrides?: Partial<User>, password?: string): Promise<User> {
  const email = overrides?.email ?? `test-${Math.random().toString(36).substring(2, 8)}@lonestone.com`

  const existingUser = await em.findOne(User, { email })
  if (existingUser) {
    const existingAccount = await em.findOne(Account, { user: { id: existingUser.id } })
    if (!existingAccount) {
      const account = em.create(Account, {
        user: existingUser,
        providerId: 'credential',
        accountId: crypto.randomUUID(),
        password: await hashPassword(password ?? 'Password123!'),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      await em.persist(account).flush()
    }

    return existingUser
  }

  const user = em.create(User, {
    name: overrides?.name ?? 'Test User',
    email,
    emailVerified: overrides?.emailVerified ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })

  const account = em.create(Account, {
    user,
    providerId: 'credential',
    accountId: crypto.randomUUID(),
    password: await hashPassword(password ?? 'Password123!'),
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  await em.persist([user, account]).flush()

  return user
}
