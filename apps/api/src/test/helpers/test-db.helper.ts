// TEST DATABASE MANAGER
//
// One PostgreSQL container serves the whole run (see test.global-setup.ts).
// The global setup builds the schema once, in a template database.
// Each Vitest worker copies that template once, into its own database.
// Before each e2e test, the worker empties its database, so every test starts from empty tables.

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

/** The database the global setup builds once per run, and that each worker copies. */
export const TEMPLATE_DB_NAME = 'test_template'

/** PostgreSQL error code for CREATE DATABASE on a name that already exists. */
const DUPLICATE_DATABASE = '42P04'

/**
 * The tables of this worker's database, listed on its first test.
 * Module state lives as long as the worker's module cache: with `isolate: false`, the whole run.
 */
let workerTables: string[] | undefined

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
 * Copies the template into this worker's database, unless an earlier test file already did.
 * Workers run their tests one at a time, so one database per worker is never shared by two tests.
 */
async function ensureWorkerDatabase(dbConfig: TestDbConfig, dbName: string): Promise<void> {
  if (workerTables) {
    return
  }
  try {
    await runOnServer(dbConfig, `CREATE DATABASE "${dbName}" TEMPLATE "${TEMPLATE_DB_NAME}"`)
  } catch (error) {
    // With `isolate: true`, each test file reloads this module: the database exists, the cache does not.
    if ((error as { code?: string }).code !== DUPLICATE_DATABASE) {
      throw error
    }
  }
}

/**
 * Deletes every row of the worker's database.
 * `delete` beats `truncate` on tables this small. The replica role skips the foreign key checks,
 * so the tables can be emptied in any order. Every key is a uuid, so no sequence needs a reset.
 */
async function emptyWorkerDatabase(orm: MikroORM): Promise<void> {
  const connection = orm.em.getConnection()
  if (!workerTables) {
    const rows: { tablename: string }[] = await connection.execute(
      `select tablename from pg_tables where schemaname = 'public'`,
    )
    workerTables = rows.map((row) => row.tablename)
  }
  const tables = workerTables

  await connection.execute(
    [
      'set session_replication_role = replica;',
      ...tables.map((table) => `delete from "${table}";`),
      'set session_replication_role = default;',
    ].join(' '),
  )
}

/**
 * Opens MikroORM on this worker's database, emptied for the test.
 * @returns TestOrmContext with ORM and MikroORM options
 */
export async function createTestOrm(dbConfig: TestDbConfig): Promise<TestOrmContext> {
  const dbName = `test_worker_${process.env.VITEST_POOL_ID ?? '1'}`
  process.env.DATABASE_NAME = dbName
  await ensureWorkerDatabase(dbConfig, dbName)

  const mikroOrmOptions = createOrmOptions(dbConfig, dbName)
  const orm = await MikroORM.init(mikroOrmOptions)
  await emptyWorkerDatabase(orm)

  return {
    orm,
    mikroOrmOptions,
  }
}

/**
 * Closes the test ORM. The worker's database stays: the next test empties it.
 * @param orm The ORM instance to cleanup
 */
export async function cleanupTestOrm(orm: MikroORM): Promise<void> {
  try {
    await orm.close(true)
  } catch (error) {
    console.error('Error while closing the test ORM:', error)
  }
}

/**
 * Resets the ORM schema
 * @param orm The ORM instance to reset
 */
export async function resetOrmSchema(orm: MikroORM): Promise<void> {
  await orm.schema.refresh()
}
