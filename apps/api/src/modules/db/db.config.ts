import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy'
import { Migrator } from '@mikro-orm/migrations'
import { defineConfig, Options } from '@mikro-orm/postgresql'
import { SeedManager } from '@mikro-orm/seeder'
import { config } from '../../config/env.config'
import { Account, Session, User, Verification } from '../auth/auth.entity'
import { Comment } from '../example/comments/comments.entity'
import { Post, PostVersion } from '../example/posts/posts.entity'

type CreateMikroOrmOptions = {
  isTest?: boolean
} & Options

const entities = [
  Account,
  Comment,
  Post,
  PostVersion,
  Session,
  User,
  Verification,
]

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
