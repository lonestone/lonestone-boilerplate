// TEST DATABASE MANAGER
//
// One PostgreSQL container serves the whole run (see test.global-setup.ts).
// The global setup builds the schema once, in a template database.
// Each e2e test gets a fresh database copied from that template, and drops it when it ends.

import { MikroORM, type EntityClass } from '@mikro-orm/core'
import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy'
import { Client } from 'pg'
import { createTestMikroOrmOptions } from '../../modules/db/db.config'

export interface TestDbConfig {
  host: string
  port: number
  user: string
  password: string
}

export interface TestOrmContext {
  orm: MikroORM
  mikroOrmOptions: ReturnType<typeof createTestMikroOrmOptions>
}

/** The database the global setup builds once per run, and that each test copies. */
export const TEMPLATE_DB_NAME = 'test_template'

/** Where each test ORM's database lives, so cleanupTestOrm can drop it. */
const testDatabases = new WeakMap<MikroORM, { dbConfig: TestDbConfig; dbName: string }>()

function getTestEntities(): EntityClass<unknown>[] {
  // @ts-expect-error - import.meta is not available in CommonJS BUT DUDE I KNOW WHAT I'M DOING
  // This file is used by Vitest and we need to use the ESM import.meta.glob to get the entities.
  const entityModules = import.meta.glob('../../modules/**/*.entity.ts', { eager: true })

  return Array.from(
    new Set(
      Object.values(entityModules).flatMap((mod) =>
        Object.values(mod as object).filter(
          (val): val is EntityClass<unknown> => typeof val === 'function',
        ),
      ),
    ),
  )
}

function createOrmOptions(
  dbConfig: TestDbConfig,
  dbName: string,
): ReturnType<typeof createTestMikroOrmOptions> {
  return createTestMikroOrmOptions({
    entitiesTs: getTestEntities(),
    allowGlobalContext: true,
    contextName: `context_${dbName}`,
    dbName,
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    preferTs: true,
    metadataProvider: ReflectMetadataProvider,
  })
}

/** Runs one statement on the server's maintenance database (CREATE/DROP DATABASE can't run elsewhere). */
async function runOnServer(dbConfig: TestDbConfig, sql: string): Promise<void> {
  const client = new Client({ ...dbConfig, database: 'postgres' })
  await client.connect()
  try {
    await client.query(sql)
  } finally {
    await client.end()
  }
}

/**
 * Builds the template database from the entities, once per run.
 * Called by the global setup, after the environment variables are set.
 */
export async function createTemplateDatabase(dbConfig: TestDbConfig): Promise<void> {
  const orm = await MikroORM.init(createOrmOptions(dbConfig, TEMPLATE_DB_NAME))
  try {
    await orm.schema.refresh()
  } finally {
    // CREATE DATABASE … TEMPLATE refuses a template that still has open connections.
    await orm.close(true)
  }
}

/**
 * Creates a database copied from the template and initializes MikroORM on it.
 * @returns TestOrmContext with ORM and MikroORM options
 */
export async function createTestOrm(dbConfig: TestDbConfig): Promise<TestOrmContext> {
  const dbName = `test_${crypto.randomUUID()}`
  process.env.DATABASE_NAME = dbName
  await runOnServer(dbConfig, `CREATE DATABASE "${dbName}" TEMPLATE "${TEMPLATE_DB_NAME}"`)

  const mikroOrmOptions = createOrmOptions(dbConfig, dbName)
  const orm = await MikroORM.init(mikroOrmOptions)
  testDatabases.set(orm, { dbConfig, dbName })

  return {
    orm,
    mikroOrmOptions,
  }
}

/**
 * Closes the ORM and drops its database
 * @param orm The ORM instance to cleanup
 */
export async function cleanupTestOrm(orm: MikroORM): Promise<void> {
  try {
    await orm.close(true)
  } catch (error) {
    console.error('Error while closing the test ORM:', error)
    // Continue cleanup even if there are errors
  }

  const testDatabase = testDatabases.get(orm)
  if (!testDatabase) {
    return
  }

  try {
    // FORCE ends any connection a test left open, so the database is always dropped.
    await runOnServer(
      testDatabase.dbConfig,
      `DROP DATABASE IF EXISTS "${testDatabase.dbName}" WITH (FORCE)`,
    )
  } catch (error) {
    console.error('Error while dropping the test database:', error)
  }
}

/**
 * Resets the ORM schema
 * @param orm The ORM instance to reset
 */
export async function resetOrmSchema(orm: MikroORM): Promise<void> {
  await orm.schema.refresh()
}
