import { hashPassword } from 'better-auth/crypto'
import { drizzle } from 'drizzle-orm/postgres-js'
import { reset, seed } from 'drizzle-seed'
import postgres from 'postgres'
import { config } from '../../config/env.config'
import { dbSchema } from './db.module'

async function main() {
  const db = drizzle(postgres(config.database.connectionStringUrl), { schema: dbSchema })

  await reset(db, dbSchema)

  const hashedPassword = await hashPassword('password123')

  // eslint-disable-next-line no-console
  console.log('Creating fixed admin user...')
  const [fixedUser] = await db.insert(dbSchema.user).values({
    name: 'Admin User',
    email: 'admin@example.com',
    emailVerified: true,
  }).returning()

  await db.insert(dbSchema.account).values({
    userId: fixedUser.id,
    password: hashedPassword,
    providerId: 'credential',
    accountId: 'admin@example.com',
  })

  // eslint-disable-next-line no-console
  console.log('Seeding users, posts and comments...')
  await seed(db, dbSchema).refine(f => ({
    user: {
      count: 50,
      columns: {
        email: f.email({ arraySize: 1 }),
      },
      with: {
        account: 1,
      },
    },
    account: {
      columns: {
        password: f.default({ defaultValue: hashedPassword }),
        providerId: f.default({ defaultValue: 'credential' }),
      },
    },
    posts: {
      count: 100,
      columns: {
        userId: f.valuesFromArray({
          values: [fixedUser.id],
          isUnique: false,
        }),
      },
      with: {
        postVersions: 2,
        comments: 10,
      },
    },
    postVersions: {
      columns: {
        content: f.default({ defaultValue: [] }),
      },
    },
  }))

  // eslint-disable-next-line no-console
  console.log('Seeding completed!')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
