import { faker } from '@faker-js/faker'
import { Dictionary, EntityManager } from '@mikro-orm/core'
import { Seeder } from '@mikro-orm/seeder'
import { hashPassword } from 'better-auth/crypto'
import { Account, User } from '../modules/auth/auth.entity'

const users = Array.from({ length: faker.number.int({ min: 5, max: 10 }) }, () => ({
  name: faker.person.fullName(),
  email: faker.internet.email(),
  password: 'Password123!',
}))

export class AuthSeeder extends Seeder {
  async run(em: EntityManager, context: Dictionary): Promise<void> {
    context.users = []
    for (const userData of users) {
      // Create user
      const user = new User()
      user.name = userData.name
      user.email = userData.email.toLowerCase()
      user.emailVerified = true
      await em.persistAndFlush(user)
      context.users.push(user)

      // Create account with password
      const account = new Account()
      account.user = user
      account.providerId = 'credential'
      account.accountId = crypto.randomUUID()
      // Store the password directly
      account.password = await hashPassword(userData.password)

      await em.persistAndFlush(account)
    }
  }
}
