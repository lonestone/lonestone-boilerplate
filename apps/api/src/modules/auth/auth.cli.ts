import type { EntityName, MikroORM as MikroORMClass } from '@mikro-orm/core'
import type { createMikroOrmOptions as CreateMikroOrmOptions, entityGlobs as EntityGlobs } from '../db/db.config'
import type { createBetterAuth as CreateBetterAuth } from './auth.config'

import { readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'

// ---------------------------------------------------------------------------
// Config consumed by the better-auth CLI only (`pnpm auth:generate`).
//
// The CLI's own TypeScript loader cannot compile the MikroORM entities
// (no decorator metadata), so the app modules are loaded through
// @swc-node/register instead - same mechanism as the `start` script.
//
// MikroORM is booted synchronously, metadata-only: no database connection.
// ---------------------------------------------------------------------------

process.env.NODE_ENV ??= 'test'

const require = createRequire(join(process.cwd(), 'src/modules/auth/auth.cli.ts'))
require('reflect-metadata')
require('@swc-node/register')

const { MikroORM } = require('@mikro-orm/core') as { MikroORM: typeof MikroORMClass }
const { createBetterAuth } = require('./auth.config.ts') as {
  createBetterAuth: typeof CreateBetterAuth
}
const { createMikroOrmOptions } = require('../db/db.config.ts') as {
  createMikroOrmOptions: typeof CreateMikroOrmOptions
}
const { entityGlobs } = require('../db/db.config.ts') as {
  entityGlobs: typeof EntityGlobs
}
const { config } = require('../../config/env.config.ts') as {
  config: typeof import('../../config/env.config').config
}

type EntityModule = Record<string, EntityName<object>>

function listFiles(dir: string, suffix: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    const stat = statSync(path)

    if (stat.isDirectory()) {
      return listFiles(path, suffix)
    }

    return path.endsWith(suffix) ? [path] : []
  })
}

function loadEntitiesFromGlob(pattern: string): EntityName<object>[] {
  const [rootPattern, suffix] = pattern.replace(/^\.\//, '').split('/**/*')

  if (!rootPattern || !suffix) {
    return []
  }

  return listFiles(resolve(process.cwd(), rootPattern), suffix).flatMap((file) => {
    const moduleExports = require(file) as EntityModule
    return Object.values(moduleExports).filter((value): value is EntityName<object> => typeof value === 'function')
  })
}

const entities = Array.from(new Set(entityGlobs.entitiesTs.flatMap(loadEntitiesFromGlob)))

export const auth = createBetterAuth({
  orm: new MikroORM(createMikroOrmOptions({ debug: false, entities, entitiesTs: entities })),
  baseUrl: config.api.baseUrl,
  secret: config.betterAuth.secret,
  trustedOrigins: config.betterAuth.trustedOrigins,
})
