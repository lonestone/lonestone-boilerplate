import { resolve } from 'node:path'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { Database, dbSchema } from 'src/modules/db/db.module'

export interface TestDbContext {
  db: Database
  client: postgres.Sql
}

/**
 * Creates a new PostgreSQL connection and initializes Drizzle
 * @returns TestDbContext with db and client
 */
export async function createTestDb(dbConfig: {
  host: string
  port: number
  user: string
  password: string
  database: string
}): Promise<TestDbContext> {
  const adminConnectionString = `postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/postgres`
  const adminClient = postgres(adminConnectionString)
  await adminClient.unsafe(`CREATE DATABASE "${dbConfig.database}"`)
  await adminClient.end()

  const connectionString = `postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`
  const client = postgres(connectionString)
  const testDb = drizzle(client, { schema: dbSchema })

  // Run migrations
  await migrate(testDb, {
    migrationsFolder: resolve(__dirname, '../../modules/db/migrations'),
  })

  return {
    db: testDb,
    client,
  }
}

/**
 * Cleans up a database connection
 * @param client The postgres client to cleanup
 */
export async function cleanupTestDb(client: postgres.Sql): Promise<void> {
  try {
    await client.end()
  }
  catch (error) {
    console.error('Error during database cleanup:', error)
  }
}
