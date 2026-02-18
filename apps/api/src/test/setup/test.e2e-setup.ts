import { afterEach, beforeEach, inject } from 'vitest'
import { clearTestSessionStore } from '../helpers/test-auth.helper'
import { cleanupTestOrm, createTestOrm } from '../helpers/test-db.helper'

beforeEach(async (context) => {
  const { orm } = await createTestOrm(inject('pgConfig'))
  context.orm = orm
})

afterEach(async (context) => {
  const { orm, app } = context

  // Close the NestJS app to avoid leaking HTTP servers
  if (app) {
    await app.close()
  }

  // Clean up the ORM
  await cleanupTestOrm(orm)

  // Clear the test session store to avoid memory leaks
  clearTestSessionStore()
})
