import type { Options } from '@mikro-orm/postgresql'
import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy'
import { Migrator } from '@mikro-orm/migrations'
import { defineConfig } from '@mikro-orm/postgresql'
import { SeedManager } from '@mikro-orm/seeder'
import { config } from '../../config/env.config'

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
    entities: [...entityGlobs.entities],
    entitiesTs: [...entityGlobs.entitiesTs],
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
