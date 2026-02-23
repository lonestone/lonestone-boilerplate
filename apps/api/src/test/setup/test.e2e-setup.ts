import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, inject } from 'vitest'
import { clearTestSessionStore } from '../helpers/test-auth.helper'
import { cleanupTestDb, createTestDb } from '../helpers/test-db.helper'

beforeEach(async (context) => {
  const { db, client } = await createTestDb({
    host: inject('pgConfig').host,
    port: inject('pgConfig').port,
    user: inject('pgConfig').user,
    password: inject('pgConfig').password,
    database: `test_${randomUUID()}`,
  })
  context.db = db
  context.dbClient = client
})

afterEach(async (context) => {
  if (context.dbClient) {
    await cleanupTestDb(context.dbClient)
  }
  clearTestSessionStore()
})
