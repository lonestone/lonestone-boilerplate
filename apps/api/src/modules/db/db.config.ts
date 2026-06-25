import type { Options } from '@mikro-orm/postgresql'
import { EntityCaseNamingStrategy } from '@mikro-orm/core'
import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy'
import { Migrator } from '@mikro-orm/migrations'
import { defineConfig } from '@mikro-orm/postgresql'
import { SeedManager } from '@mikro-orm/seeder'
import { config } from '../../config/env.config'
import { Account, Session, User, Verification } from '../auth/auth.entity'
import { Comment } from '../example/comments/comments.entity'
import { Post, PostVersion } from '../example/posts/posts.entity'
import { Tag } from '../example/tags/tag.entity'

const entities = [
  Account,
  Comment,
  Post,
  PostVersion,
  Session,
  Tag,
  User,
  Verification,
]

type CreateMikroOrmOptions = {
  isTest?: boolean
} & Options

export const entityGlobs = {
  entities: ['./dist/**/*.entity.js'],
  entitiesTs: ['./src/**/*.entity.ts'],
} as const

export function createMikroOrmOptions(options?: CreateMikroOrmOptions) {
  return defineConfig({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    dbName: config.database.name,
    entities,
    entitiesTs: entities,
    metadataProvider: ReflectMetadataProvider,
    // Column names mirror entity property names verbatim (camelCase),
    // matching the database schema. Relation FK columns still declare an
    // explicit `fieldName` since the property name (e.g. `user`) differs
    // from the column (e.g. `userId`).
    namingStrategy: EntityCaseNamingStrategy,
    forceUtcTimezone: true,
    debug: config.env === 'development',
    extensions: [SeedManager, Migrator],
    migrations: {
      path: './dist/modules/db/migrations',
      pathTs: './src/modules/db/migrations',
      allOrNothing: true,
      disableForeignKeys: false,
    },
    seeder: {
      path: './dist/seeders',
      pathTs: './src/seeders',
      defaultSeeder: 'DatabaseSeeder',
      glob: '!(*.d).{js,ts}',
      emit: 'ts',
      fileName: (className: string) => className,
    },
    ...options,
  })
}

export function createTestMikroOrmOptions(options?: Options) {
  return createMikroOrmOptions({ isTest: true, ...options })
}

export default createMikroOrmOptions
