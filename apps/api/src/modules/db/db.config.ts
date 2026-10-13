import type { Options } from '@mikro-orm/postgresql'
import { EntityCaseNamingStrategy } from '@mikro-orm/core'
import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy'
import { Migrator } from '@mikro-orm/migrations'
import { defineConfig } from '@mikro-orm/postgresql'
import { SeedManager } from '@mikro-orm/seeder'
import { config } from '../../config/env.config'

type CreateMikroOrmOptions = {
  isTest?: boolean
} & Options

// Folder discovery, for the MikroORM CLI. Code that runs through Vite passes the classes
// from `entities.ts` instead (see `db.service.ts`).
export const entityGlobs = {
  entities: ['./dist/**/*.entity.js'],
  entitiesTs: ['./src/**/*.entity.ts'],
}

export function createMikroOrmOptions(options?: CreateMikroOrmOptions) {
  const { migrations, ...rest } = options ?? {}

  return defineConfig({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    dbName: config.database.name,
    entities: entityGlobs.entities,
    entitiesTs: entityGlobs.entitiesTs,
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
      // MikroORM writes `${snapshotName}.json` in the migrations folder.
      snapshotName: 'snapshot',
      allOrNothing: true,
      disableForeignKeys: false,
      ...migrations,
    },
    seeder: {
      path: './dist/seeders',
      pathTs: './src/seeders',
      defaultSeeder: 'DatabaseSeeder',
      glob: '!(*.d).{js,ts}',
      emit: 'ts',
      fileName: (className: string) => className,
    },
    ...rest,
  })
}

export function createTestMikroOrmOptions(options?: Options) {
  return createMikroOrmOptions({ isTest: true, ...options })
}

export default createMikroOrmOptions
