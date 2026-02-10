// TEST CONTAINER MANAGER
//
// Utilities for managing per-test database containers.
// This provides maximum isolation with one container per test.

import { MikroORM, Options } from '@mikro-orm/core'
import { createTestMikroOrmOptions } from '../../config/mikro-orm.config'

export interface TestOrmContext {
  orm: MikroORM
  mikroOrmOptions: Options
}

/**
 * Creates a new PostgreSQL container and initializes MikroORM
 * @returns TestOrmContext with ORM and MikroORM options
 */
export async function createTestOrm(dbConfig: {
  host: string
  port: number
  user: string
  password: string
}): Promise<TestOrmContext> {
  // @ts-expect-error - import.meta is not available in CommonJS BUT DUDE I KNOW WHAT I'M DOING
  // This file is used by Vitest and we need to use the ESM import.meta.glob to get the entities.
  const entityModules = import.meta.glob('../../modules/**/*.entity.ts', { eager: true })

  const allEntities = Object.values(entityModules).flatMap(mod =>
    Object.values(mod as object).filter(val => typeof val === 'function'),
  )

  const dbName = `test_${crypto.randomUUID()}`
  process.env.DATABASE_NAME = dbName
  // Initialize ORM with the container's database
  const mikroOrmOptions = createTestMikroOrmOptions({
    entitiesTs: allEntities,
    allowGlobalContext: true,
    contextName: `context_${dbName}`,
    dbName,
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    preferTs: true,
  })

  const orm = await MikroORM.init(mikroOrmOptions)
  await orm.schema.refreshDatabase()

  return {
    orm,
    mikroOrmOptions,
  }
}

/**
 * Cleans up an ORM
 * @param orm The ORM instance to cleanup
 */
export async function cleanupTestOrm(orm: MikroORM): Promise<void> {
  try {
    await orm.close(true)
  }
  catch (error) {
    console.error('Error during container cleanup:', error)
    // Continue cleanup even if there are errors
  }
}

/**
 * Resets the ORM schema
 * @param orm The ORM instance to reset
 */
export async function resetOrmSchema(orm: MikroORM): Promise<void> {
  await orm.schema.refreshDatabase()
}
