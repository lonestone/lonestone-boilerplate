// GLOBAL TEST SETUP
//
// This file runs BEFORE any modules are loaded, ensuring environment variables
// are set before env.config.ts validates them.
// Test containers are now managed per test for maximum isolation.

import type { EntityManager, MikroORM } from '@mikro-orm/core'
import type { INestApplication } from '@nestjs/common'
import type { TestProject } from 'vitest/node'
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import type { TestRequest } from '../helpers/test-auth.helper'

const MIGRATION_SCHEMA_CHECK_DB = 'migration_schema_check'

declare module 'vitest' {
  export interface ProvidedContext {
    pgConfig: {
      host: string
      port: number
      user: string
      password: string
    }
  }

  export interface TestContext {
    orm: MikroORM
    em: EntityManager
    request: TestRequest
    app: INestApplication
  }
}

export default async function setup(project: TestProject) {
  const { provide } = project
  // Start a new container for this test
  const container = await new PostgreSqlContainer('postgres:16-alpine').start()

  const host = container.getHost()
  const port = container.getPort()
  const user = container.getUsername()
  const password = container.getPassword()
  const dbName = container.getDatabase()

  process.env.NODE_ENV = 'test'
  process.env.CLIENTS_WEB_APP_URL = 'http://localhost:3000'
  process.env.CLIENTS_WEB_SSR_URL = 'http://localhost:5174'
  process.env.S3_ENDPOINT = 'http://localhost:9000'
  process.env.S3_REGION = 'us-east-1'
  process.env.S3_ACCESS_KEY_ID = 'minioadmin'
  process.env.S3_SECRET_ACCESS_KEY = 'minioadmin'
  process.env.S3_BUCKET = 'test'

  // API and Auth variables
  process.env.API_PORT = '3000'
  process.env.BETTER_AUTH_SECRET = 'test-secret-key-for-testing-only'
  process.env.TRUSTED_ORIGINS = 'http://localhost:3000'

  // AI variables
  process.env.MISTRAL_API_KEY = 'test'
  process.env.LANGFUSE_SECRET_KEY = 'test'
  process.env.LANGFUSE_PUBLIC_KEY = 'test'
  process.env.LANGFUSE_BASE_URL = 'http://localhost:3000'
  process.env.AI_DISABLED = 'true'

  // Update environment variables for this test
  process.env.DATABASE_HOST = host
  process.env.DATABASE_PORT = port.toString()
  process.env.DATABASE_USER = user
  process.env.DATABASE_PASSWORD = password
  process.env.DATABASE_NAME = dbName

  provide('pgConfig', {
    host,
    port,
    user,
    password,
  })

  await assertMigrationsMatchEntities({ host, port, user, password })

  return function teardown() {
    container.stop()
  }
}

/**
 * Applies source migrations once on a dedicated database, then fails the whole
 * suite if entities still differ from `snapshot.json`. Per-test DBs stay on
 * `schema.refresh()`; this must not live in e2e setup.
 *
 * `up()` temporarily disables snapshot writes so a dedicated test DB cannot
 * rewrite `snapshot.json`. `checkSchema()` then uses that file (MikroORM
 * appends `.json` to `migrations.snapshotName`). This uses TypeScript sources,
 * not `dist/migrate.js`.
 */
async function assertMigrationsMatchEntities(connection: {
  host: string
  port: number
  user: string
  password: string
}): Promise<void> {
  const { MikroORM } = await import('@mikro-orm/core')
  const { createMikroOrmOptions } = await import('../../modules/db/db.config')

  const orm = await MikroORM.init(
    createMikroOrmOptions({
      dbName: MIGRATION_SCHEMA_CHECK_DB,
      host: connection.host,
      port: connection.port,
      user: connection.user,
      password: connection.password,
      preferTs: true,
      allowGlobalContext: true,
      debug: false,
      logger: () => undefined,
    }),
  )

  try {
    await orm.schema.ensureDatabase()

    const migrations = orm.config.get('migrations')
    migrations.snapshot = false
    await orm.migrator.up()
    migrations.snapshot = true

    const hasDrift = await orm.migrator.checkSchema()
    if (!hasDrift) {
      return
    }

    throw new MigrationSchemaCheckError(
      [
        'Entities and migrations have drifted: after applying all source migrations, MikroORM still reports a schema diff against snapshot.json.',
        'pnpm test stops before the first test. This check uses TypeScript sources, not dist/migrate.js.',
        'Create a migration with `pnpm db:migrate:create`, commit the new file and snapshot.json, then re-run tests.',
      ].join('\n'),
    )
  } catch (error) {
    if (error instanceof MigrationSchemaCheckError) {
      throw error
    }

    const details = error instanceof Error ? error.message : String(error)
    throw new MigrationSchemaCheckError(
      [
        'Failed to apply source migrations in test global setup. pnpm test stops before the first test.',
        'This check uses TypeScript sources, not dist/migrate.js.',
        details,
      ].join('\n'),
      { cause: error },
    )
  } finally {
    await orm.close(true)
  }
}

class MigrationSchemaCheckError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'MigrationSchemaCheckError'
  }
}
