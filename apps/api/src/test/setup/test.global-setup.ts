// GLOBAL TEST SETUP
//
// This file runs BEFORE any modules are loaded, ensuring environment variables
// are set before env.config.ts validates them.
// Test containers are now managed per test for maximum isolation.

import type { TestProject } from 'vitest/node'
import { EntityManager, MikroORM } from '@mikro-orm/core'
import { INestApplication } from '@nestjs/common'
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { TestRequest } from '../helpers/test-auth.helper'

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

  return function teardown() {
    container.stop()
  }
}
