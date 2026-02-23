import { drizzle } from 'drizzle-orm/postgres-js'
import { Elysia } from 'elysia'
import postgres from 'postgres'

import { config } from '../../config/env.config'

import * as authSchema from './schemas/auth.schema'
import * as commentSchema from './schemas/example/comments.schema'
import * as postSchema from './schemas/example/posts.schema'

export const dbSchema = {
  ...postSchema,
  ...commentSchema,
  ...authSchema,
}

export const db = drizzle(
  postgres(config.database.connectionStringUrl),
  { schema: dbSchema, logger: config.env === 'development' },
)

export const dbModule = new Elysia({ name: 'db' })
  .decorate('db', db)

export type Database = typeof db
