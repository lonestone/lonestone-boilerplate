// TEST CONTAINER MANAGER
//
// Utilities for managing per-test database containers.
// This provides maximum isolation with one container per test.

import { MikroORM, Options } from '@mikro-orm/core'
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { createTestMikroOrmOptions } from '../config/mikro-orm.config'

export interface TestContainerContext {
  container: StartedPostgreSqlContainer
  orm: MikroORM
  mikroOrmOptions: Options
}

/**
 * Creates a new PostgreSQL container and initializes MikroORM
 * @returns TestContainerContext with container and ORM
 */
export async function createTestContainer(): Promise<TestContainerContext> {
  // Start a new container for this test
  const container = await new PostgreSqlContainer('postgres:16-alpine').start()

  // Update environment variables for this test
  process.env.DATABASE_HOST = container.getHost()
  process.env.DATABASE_PORT = container.getPort().toString()
  process.env.DATABASE_USER = container.getUsername()
  process.env.DATABASE_PASSWORD = container.getPassword()
  process.env.DATABASE_NAME = container.getDatabase()

  // @ts-expect-error - import.meta is not available in CommonJS BUT DUDE I KNOW WHAT I'M DOING
  // This file is used by Vitest and we need to use the ESM import.meta.glob to get the entities.
  const entityModules = import.meta.glob('../modules/**/*.entity.ts', { eager: true })

  const allEntities = Object.values(entityModules).flatMap(mod =>
    Object.values(mod as object).filter(val => typeof val === 'function'),
  )

  // Initialize ORM with the container's database
  const mikroOrmOptions = createTestMikroOrmOptions({
    entitiesTs: allEntities,
    allowGlobalContext: true,
    dbName: container.getDatabase(),
    host: container.getHost(),
    port: container.getPort(),
    user: container.getUsername(),
    password: container.getPassword(),
    preferTs: true,
  })

  const orm = await MikroORM.init(mikroOrmOptions)

  // Create the database schema
  await orm.schema.refreshDatabase()

  return { container, orm, mikroOrmOptions }
}

/**
 * Cleans up a test container and its ORM
 * @param context The test container context to cleanup
 */
export async function cleanupTestContainer(context: TestContainerContext): Promise<void> {
  try {
    await context.orm.close(true)
    await context.container.stop()
  }
  catch (error) {
    console.error('Error during container cleanup:', error)
    // Continue cleanup even if there are errors
  }
}

/**
 * Resets the database schema within a container (for use between tests in same file)
 * @param orm The ORM instance to reset
 */
export async function resetDatabaseSchema(orm: MikroORM): Promise<void> {
  await orm.schema.refreshDatabase()
}
