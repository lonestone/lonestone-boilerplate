import type { MikroORM as MikroORMClass } from '@mikro-orm/core'
import type { createMikroOrmOptions as CreateMikroOrmOptions } from '../db/db.config'
import type { createBetterAuth as CreateBetterAuth } from './auth.config'

import { createRequire } from 'node:module'
import { join } from 'node:path'

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
const { config } = require('../../config/env.config.ts') as {
  config: typeof import('../../config/env.config').config
}

export const auth = createBetterAuth({
  orm: new MikroORM(createMikroOrmOptions({ debug: false })),
  baseUrl: config.api.baseUrl,
  secret: config.betterAuth.secret,
  trustedOrigins: config.betterAuth.trustedOrigins,
})
