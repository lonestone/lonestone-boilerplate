import { MikroORM } from '@mikro-orm/core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createMikroOrmOptions } from '../db/db.config'
import { validateAuthSchema } from './auth-db.adapter'
import { createBetterAuth } from './auth.config'

describe('better-auth schema drift', () => {
  let orm: MikroORM

  beforeAll(async () => {
    orm = await MikroORM.init(createMikroOrmOptions({ debug: false }))
  })

  afterAll(async () => {
    await orm.close(true)
  })

  it('maps every better-auth model and field to a MikroORM entity', () => {
    const auth = createBetterAuth({
      baseUrl: 'http://localhost:3000',
      orm,
      secret: 'unit-test-secret-unit-test-secret',
      trustedOrigins: ['http://localhost:5173'],
    })

    expect(validateAuthSchema(orm, auth.options)).toEqual([])
  })
})
