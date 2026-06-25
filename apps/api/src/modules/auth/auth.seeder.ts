import { faker } from '@faker-js/faker'
import { Dictionary, EntityManager } from '@mikro-orm/core'
import { Seeder } from '@mikro-orm/seeder'
import { createUserData } from './auth.factory'

const password = 'Password123!'

const defaultUser = {
  name: 'John Doe',
  email: 'user@lonestone.com',
  password,
}

const users = Array.from({ length: faker.number.int({ min: 5, max: 10 }) }, () => ({
  name: faker.person.fullName(),
  email: faker.internet.email(),
  password: 'Password123!',
}))

export class AuthSeeder extends Seeder {
  async run(em: EntityManager, context: Dictionary): Promise<void> {
    context.users = []
    for (const userData of [defaultUser, ...users]) {
      const user = await createUserData(em, {
        name: userData.name,
        email: userData.email.toLowerCase(),
        emailVerified: true,
      }, userData.password)
      context.users.push(user)
    }
  }
}
